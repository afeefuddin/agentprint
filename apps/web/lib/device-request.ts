import { NextResponse } from "next/server";
import { createPublicKey, verify } from "node:crypto";
import { authenticateDevice } from "@agentprint/database";
import { decompressDeviceRequestBody, PayloadTooLargeError } from "./bounded-gzip";

export { decompressDeviceRequestBody } from "./bounded-gzip";

const DEFAULT_MAX_COMPRESSED_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_DECOMPRESSED_BYTES = 32 * 1024 * 1024;

export async function readDeviceRequestBody(request: Request, maxBytes: number): Promise<Buffer> {
  if (!request.body) return Buffer.alloc(0);

  const reader = request.body.getReader();
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw new PayloadTooLargeError("compressed", maxBytes);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, totalBytes);
}

function signingKey(raw: Buffer) {
  // RFC 8410 SubjectPublicKeyInfo prefix for a raw 32-byte Ed25519 public key.
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  return createPublicKey({ key: Buffer.concat([prefix, raw]), format: "der", type: "spki" });
}

type AuthenticatedDevice = NonNullable<Awaited<ReturnType<typeof authenticateDevice>>>;

/*
 * Shared by usage sync and session sharing: authenticate the device, verify the
 * Ed25519 signature over `<unix-timestamp>.<compressed-body>`, then decode the
 * gzipped JSON. Callers apply their own contract schema to the result.
 */
export async function readSignedDeviceRequest(
  request: Request,
  options: {
    requireUnpaused?: boolean;
    maxCompressedBytes?: number;
    maxDecompressedBytes?: number;
  } = {}
): Promise<
  | { device: AuthenticatedDevice; payload: unknown; response: null }
  | { device: null; payload: null; response: NextResponse }
> {
  const failure = (status: number, error: string, message: string) => ({
    device: null,
    payload: null,
    response: NextResponse.json({ error, message }, { status })
  } as const);

  const device = await authenticateDevice(request.headers.get("authorization"));
  if (!device) {
    return failure(401, "unauthorized", "The device credential is missing, invalid, or revoked.");
  }
  if (options.requireUnpaused && device.paused) {
    return failure(423, "device_paused", "Resume collection before syncing.");
  }
  if (!device.signing_public_key) {
    return failure(401, "unsigned_device", "Reconnect this device and try again.");
  }
  const timestamp = request.headers.get("x-agentprint-timestamp");
  const signature = request.headers.get("x-agentprint-signature");
  const timestampNumber = Number(timestamp);
  if (
    !timestamp ||
    !signature ||
    !Number.isFinite(timestampNumber) ||
    Math.abs(Date.now() - timestampNumber * 1_000) > 5 * 60 * 1_000
  ) {
    return failure(
      401,
      "invalid_signature_time",
      "Reconnect this device and try again."
    );
  }
  const maxCompressedBytes = options.maxCompressedBytes ?? DEFAULT_MAX_COMPRESSED_BYTES;
  const maxDecompressedBytes = options.maxDecompressedBytes ?? DEFAULT_MAX_DECOMPRESSED_BYTES;
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > maxCompressedBytes) {
    return failure(413, "payload_too_large", "This request is too large.");
  }
  let compressed: Buffer;
  try {
    compressed = await readDeviceRequestBody(request, maxCompressedBytes);
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return failure(413, "payload_too_large", "This request is too large.");
    }
    return failure(400, "invalid_payload", "This request could not be processed.");
  }
  const signed = Buffer.concat([Buffer.from(`${timestamp}.`), compressed]);
  let valid = false;
  try {
    valid = verify(
      null,
      signed,
      signingKey(Buffer.from(device.signing_public_key, "base64")),
      Buffer.from(signature, "base64")
    );
  } catch {
    valid = false;
  }
  if (!valid) {
    return failure(401, "invalid_signature", "Reconnect this device and try again.");
  }
  let body: Buffer;
  try {
    body = request.headers.get("content-encoding") === "gzip"
      ? await decompressDeviceRequestBody(compressed, maxDecompressedBytes)
      : compressed;
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return failure(413, "payload_too_large", "This request is too large.");
    }
    return failure(400, "invalid_payload", "This request could not be processed.");
  }
  if (body.byteLength > maxDecompressedBytes) {
    return failure(413, "payload_too_large", "This request is too large.");
  }
  try {
    return { device, payload: JSON.parse(body.toString("utf8")), response: null };
  } catch {
    return failure(400, "invalid_payload", "This request could not be processed.");
  }
}

/*
 * Resolve the acting user from either a browser session cookie or a device
 * bearer token, so `agentprint shares` and the dashboard can manage the same
 * shares. Only content uploads require the Ed25519 signature; listing and
 * revoking are ordinary authenticated reads and writes.
 */
export async function resolveOwner(
  request: Request,
  cookieViewer: () => Promise<{ id: string } | null>
) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) {
    const device = await authenticateDevice(authorization);
    return device ? { id: device.user_id } : null;
  }
  return cookieViewer();
}

export function contractFailure(issues: Array<{ path: PropertyKey[]; message: string }>) {
  return NextResponse.json(
    {
      error: "invalid_request",
      message: "This request could not be accepted.",
      issues: issues.slice(0, 20).map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message
      }))
    },
    { status: 400 }
  );
}
