import { createHash } from "node:crypto";
import { auditShareForCredentials, sessionShareSchema } from "@agentprint/contracts";
import {
  beginSessionShareUploadProcessing,
  completeSessionShareUpload,
  failSessionShareUpload,
  getSessionShareUpload,
  publishShare
} from "@agentprint/database";
import { decompressDeviceRequestBody } from "./bounded-gzip";
import {
  deleteSessionShareUpload,
  MAX_SHARE_UPLOAD_BYTES,
  readSessionShareUpload
} from "./spaces";

const MAX_DECOMPRESSED_SHARE_BYTES = 32 * 1024 * 1024;

export class PermanentSessionShareUploadError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

async function permanentlyFail(uploadId: string, objectKey: string, code: string): Promise<never> {
  await failSessionShareUpload(uploadId, code);
  try {
    await deleteSessionShareUpload(objectKey);
  } catch {
    // The Space lifecycle rule remains the final cleanup backstop.
  }
  throw new PermanentSessionShareUploadError(code);
}

export async function processSessionShareUpload(uploadId: string) {
  const existing = await getSessionShareUpload(uploadId);
  if (!existing) throw new PermanentSessionShareUploadError("upload_not_found");
  if (existing.status === "published") {
    return { status: "published" as const, shareId: existing.share_id };
  }
  if (existing.status === "failed") {
    throw new PermanentSessionShareUploadError(existing.failure_code ?? "upload_failed");
  }

  const upload = await beginSessionShareUploadProcessing(uploadId);
  if (!upload) {
    await permanentlyFail(uploadId, existing.object_key, "upload_expired");
  }

  const compressed = await readSessionShareUpload(upload.object_key, MAX_SHARE_UPLOAD_BYTES);
  if (compressed.byteLength !== upload.content_length) {
    await permanentlyFail(uploadId, upload.object_key, "upload_size_mismatch");
  }
  const digest = createHash("sha256").update(compressed).digest("hex");
  if (digest !== upload.content_sha256) {
    await permanentlyFail(uploadId, upload.object_key, "upload_checksum_mismatch");
  }

  let decoded: Buffer;
  try {
    decoded = await decompressDeviceRequestBody(compressed, MAX_DECOMPRESSED_SHARE_BYTES);
  } catch {
    return permanentlyFail(uploadId, upload.object_key, "invalid_compressed_payload");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(decoded.toString("utf8"));
  } catch {
    return permanentlyFail(uploadId, upload.object_key, "invalid_json_payload");
  }
  const parsed = sessionShareSchema.safeParse(payload);
  if (!parsed.success) {
    return permanentlyFail(uploadId, upload.object_key, "invalid_session_share");
  }
  const credentials = auditShareForCredentials(parsed.data);
  if (credentials.length > 0) {
    await permanentlyFail(uploadId, upload.object_key, "credentials_detected");
  }

  const result = await publishShare(
    { userId: upload.user_id, deviceId: upload.device_id },
    parsed.data
  );
  await completeSessionShareUpload(uploadId, result.id);
  await deleteSessionShareUpload(upload.object_key);
  return { status: "published" as const, shareId: result.id, replaced: result.replaced };
}
