import { createHash } from "node:crypto";
import {
  auditShareForCredentials,
  sessionShareSchema,
  type SessionShare
} from "@agentprint/contracts";
import {
  beginSessionShareUploadProcessing,
  failSessionShareUpload,
  getSessionShareUpload,
  publishSessionShareUpload
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

export async function validateSessionShareUpload(
  compressed: Buffer,
  integrity: { contentLength: number; contentSha256: string }
): Promise<SessionShare> {
  if (compressed.byteLength !== integrity.contentLength) {
    throw new PermanentSessionShareUploadError("upload_size_mismatch");
  }
  const digest = createHash("sha256").update(compressed).digest("hex");
  if (digest !== integrity.contentSha256) {
    throw new PermanentSessionShareUploadError("upload_checksum_mismatch");
  }

  let decoded: Buffer;
  try {
    decoded = await decompressDeviceRequestBody(compressed, MAX_DECOMPRESSED_SHARE_BYTES);
  } catch {
    throw new PermanentSessionShareUploadError("invalid_compressed_payload");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(decoded.toString("utf8"));
  } catch {
    throw new PermanentSessionShareUploadError("invalid_json_payload");
  }
  const parsed = sessionShareSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PermanentSessionShareUploadError("invalid_session_share");
  }
  if (auditShareForCredentials(parsed.data).length > 0) {
    throw new PermanentSessionShareUploadError("credentials_detected");
  }
  return parsed.data;
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
  let share: SessionShare;
  try {
    share = await validateSessionShareUpload(compressed, {
      contentLength: upload.content_length,
      contentSha256: upload.content_sha256
    });
  } catch (error) {
    if (error instanceof PermanentSessionShareUploadError) {
      return permanentlyFail(uploadId, upload.object_key, error.code);
    }
    throw error;
  }

  const result = await publishSessionShareUpload(uploadId, share);
  try {
    await deleteSessionShareUpload(upload.object_key);
  } catch {
    // Publication is already committed. The one-day lifecycle rule is the
    // cleanup backstop and a storage failure must not turn success into failure.
  }
  return { status: "published" as const, shareId: result.id, replaced: result.replaced };
}
