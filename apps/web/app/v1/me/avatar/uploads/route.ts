import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import {
  MAX_PROFILE_AVATAR_BYTES,
  PROFILE_AVATAR_CONTENT_TYPES,
  presignProfileAvatarUpload
} from "@/lib/avatar-storage";
import { readDeviceRequestBody } from "@/lib/device-request";
import { clientAddress, tooManyRequests, unauthorized } from "@/lib/http";

const reservationSchema = z.object({
  content_type: z.enum(PROFILE_AVATAR_CONTENT_TYPES),
  content_length: z.number().int().positive().max(MAX_PROFILE_AVATAR_BYTES)
}).strict();

async function readReservation(request: Request) {
  try {
    const body = await readDeviceRequestBody(request, 1024);
    return reservationSchema.safeParse(JSON.parse(body.toString("utf8")));
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const current = await apiViewer();
  if (!current) return unauthorized();

  const parsed = await readReservation(request);
  if (!parsed?.success) {
    return NextResponse.json(
      { message: "Choose a JPEG, PNG, or WebP image up to 5 MB." },
      { status: 400 }
    );
  }

  const [allowedUser, allowedAddress, allowedGlobal] = await Promise.all([
    consumeRateLimit(`avatar-upload:${current.id}`, 30, 3600),
    consumeRateLimit(`avatar-upload-ip:${clientAddress(request)}`, 60, 3600),
    consumeRateLimit("avatar-upload:global", 5_000, 3600)
  ]);
  if (!allowedUser || !allowedAddress || !allowedGlobal) return tooManyRequests();

  const uploadId = randomUUID();
  try {
    const signed = await presignProfileAvatarUpload({
      userId: current.id,
      uploadId,
      contentType: parsed.data.content_type,
      contentLength: parsed.data.content_length
    });
    return NextResponse.json({
      upload_id: uploadId,
      upload_url: signed.url,
      fields: signed.fields,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString()
    }, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: "Your profile picture cannot be saved right now. Try again shortly." },
      { status: 503 }
    );
  }
}
