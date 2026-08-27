import { NextResponse } from "next/server";
import { z } from "zod";
import { harnessIds } from "@agentprint/contracts";
import { consumeRateLimit, createSessionShareUpload, failSessionShareUpload } from "@agentprint/database";
import { readSignedDeviceRequest } from "@/lib/device-request";
import { clientAddress, tooManyRequests } from "@/lib/http";
import { MAX_SHARE_UPLOAD_BYTES, presignSessionShareUpload } from "@/lib/spaces";

const uploadReservationSchema = z.object({
  content_length: z.number().int().positive().max(MAX_SHARE_UPLOAD_BYTES),
  content_sha256: z.string().regex(/^[a-f0-9]{64}$/),
  title: z.string().trim().min(1).max(140).optional(),
  harness_id: z.enum(harnessIds).optional()
}).strict();

const GLOBAL_SHARE_UPLOADS_PER_HOUR = 5_000;

export async function POST(request: Request) {
  const { device, payload, response } = await readSignedDeviceRequest(request, {
    maxCompressedBytes: 4 * 1024,
    maxDecompressedBytes: 4 * 1024
  });
  if (response) return response;
  const parsed = uploadReservationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "That session could not be prepared for publishing. Try again." },
      { status: 400 }
    );
  }
  const [allowedUser, allowedAddress] = await Promise.all([
    consumeRateLimit(`share-upload:${device.user_id}`, 60, 3600),
    consumeRateLimit(`share-upload-ip:${clientAddress(request)}`, 120, 3600)
  ]);
  if (!allowedUser || !allowedAddress) return tooManyRequests();
  if (!(await consumeRateLimit("share-upload:global", GLOBAL_SHARE_UPLOADS_PER_HOUR, 3600))) {
    return tooManyRequests();
  }

  const upload = await createSessionShareUpload({
    userId: device.user_id,
    deviceId: device.id,
    contentLength: parsed.data.content_length,
    contentSha256: parsed.data.content_sha256,
    displayTitle: parsed.data.title,
    harnessId: parsed.data.harness_id
  });
  if (!upload) return tooManyRequests();

  try {
    const presigned = await presignSessionShareUpload(upload.object_key, upload.content_length);
    return NextResponse.json(
      {
        upload_id: upload.id,
        upload_url: presigned.url,
        fields: presigned.fields,
        expires_at: upload.expires_at.toISOString(),
      },
      { status: 201 }
    );
  } catch {
    await failSessionShareUpload(upload.id, "storage_unavailable");
    return NextResponse.json(
      { error: "upload_unavailable", message: "Your session cannot be published right now. Try again shortly." },
      { status: 503 }
    );
  }
}
