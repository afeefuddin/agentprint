import { NextResponse } from "next/server";
import { z } from "zod";
import { tasks } from "@trigger.dev/sdk";
import {
  consumeRateLimit,
  getSessionShareUploadForOwner,
  markSessionShareUploadQueued
} from "@agentprint/database";
import type { processSessionShareTask } from "@/trigger/process-session-share";
import { readSignedDeviceRequest } from "@/lib/device-request";
import { inspectSessionShareUpload } from "@/lib/spaces";
import { tooManyRequests } from "@/lib/http";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { device, response } = await readSignedDeviceRequest(request, {
    maxCompressedBytes: 1024,
    maxDecompressedBytes: 1024
  });
  if (response) return response;
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
    return NextResponse.json(
      { error: "upload_expired", message: "That upload reservation has expired." },
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
        { error: "upload_mismatch", message: "The uploaded object did not match its reservation." },
        { status: 422 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "upload_incomplete", message: "The session upload has not completed." },
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
      { error: "queue_unavailable", message: "The session was uploaded but could not be queued. Retry shortly." },
      { status: 503 }
    );
  }
}
