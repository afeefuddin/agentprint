import { NextResponse } from "next/server";
import { z } from "zod";
import { tasks } from "@trigger.dev/sdk";
import {
  consumeRateLimit,
  failSessionShareUpload,
  getSessionShareUploadForOwner,
  markSessionShareUploadQueued
} from "@agentprint/database";
import type { processSessionShareTask } from "@/trigger/process-session-share";
import { readSignedDeviceRequest } from "@/lib/device-request";
import { inspectSessionShareUpload, isMissingSpaceObject } from "@/lib/spaces";
import { tooManyRequests } from "@/lib/http";

const finalizeSchema = z.object({}).strict();

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { device, payload, response } = await readSignedDeviceRequest(request, {
    maxCompressedBytes: 1024,
    maxDecompressedBytes: 1024
  });
  if (response) return response;
  if (!finalizeSchema.safeParse(payload).success) {
    return NextResponse.json(
      { error: "invalid_request", message: "That session could not be published. Try again." },
      { status: 400 }
    );
  }
  if (!(await consumeRateLimit(`share-finalize:${device.user_id}`, 120, 3600))) {
    return tooManyRequests();
  }

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "upload_not_found", message: "That session upload was not found." },
      { status: 404 }
    );
  }
  const upload = await getSessionShareUploadForOwner(id, device.user_id);
  if (!upload || upload.device_id !== device.id) {
    return NextResponse.json(
      { error: "upload_not_found", message: "That session upload was not found." },
      { status: 404 }
    );
  }
  if (upload.status === "failed") {
    return NextResponse.json(
      { error: upload.failure_code ?? "upload_failed", message: "That session upload cannot be processed." },
      { status: 409 }
    );
  }
  if (upload.status === "published") {
    return NextResponse.json({ upload_id: upload.id, status: "published", share_id: upload.share_id });
  }
  if (upload.expires_at.getTime() <= Date.now()) {
    await failSessionShareUpload(upload.id, "upload_expired");
    return NextResponse.json(
      { error: "upload_expired", message: "That session took too long to upload. Upload it again." },
      { status: 410 }
    );
  }

  try {
    const object = await inspectSessionShareUpload(upload.object_key);
    if (
      object.contentLength !== upload.content_length ||
      object.contentType !== "application/json" ||
      object.contentEncoding !== "gzip"
    ) {
      return NextResponse.json(
        { error: "upload_mismatch", message: "That session could not be verified. Upload it again." },
        { status: 422 }
      );
    }
  } catch (error) {
    if (!isMissingSpaceObject(error)) {
      return NextResponse.json(
        { error: "storage_unavailable", message: "Your session cannot be published right now. Try again shortly." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "upload_incomplete", message: "Your session has not finished uploading. Try again." },
      { status: 409 }
    );
  }

  try {
    const run = await tasks.trigger<typeof processSessionShareTask>(
      "process-session-share",
      { uploadId: upload.id },
      { idempotencyKey: upload.id, idempotencyKeyTTL: "1d", ttl: "24h" }
    );
    await markSessionShareUploadQueued(upload.id, run.id);
    return NextResponse.json(
      { upload_id: upload.id, status: "queued", run_id: run.id },
      { status: 202 }
    );
  } catch {
    return NextResponse.json(
      { error: "queue_unavailable", message: "Your session cannot be published right now. Try again shortly." },
      { status: 503 }
    );
  }
}
