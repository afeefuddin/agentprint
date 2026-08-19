import { NextResponse } from "next/server";
import { createPublicKey, verify } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { authenticateDevice } from "@agentprint/database";

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
  options: { requireUnpaused?: boolean; maxBytes?: number } = {}
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
    return failure(401, "unsigned_device", "Re-authenticate this device to enable signed requests.");
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
      "The signed request timestamp is missing or outside the five-minute window."
    );
  }
  const compressed = Buffer.from(await request.arrayBuffer());
  if (options.maxBytes && compressed.byteLength > options.maxBytes) {
    return failure(413, "payload_too_large", "The request body exceeded the maximum accepted size.");
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
    return failure(401, "invalid_signature", "The request signature could not be verified.");
  }
  try {
    const body = request.headers.get("content-encoding") === "gzip"
      ? gunzipSync(compressed)
      : compressed;
    return { device, payload: JSON.parse(body.toString("utf8")), response: null };
  } catch {
    return failure(400, "invalid_payload", "The compressed JSON payload could not be decoded.");
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
      message: "The request did not match the expected contract.",
      issues: issues.slice(0, 20).map((issue) => ({
        path: issue.path.map(String).join("."),
        message: issue.message
      }))
    },
    { status: 400 }
  );
}
