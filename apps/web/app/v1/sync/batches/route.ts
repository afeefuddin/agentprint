import { NextResponse } from "next/server";
import { createPublicKey, verify } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { authenticateDevice, ingestBatch } from "@agentprint/database";
import { syncBatchSchema } from "@agentprint/contracts";
import { unauthorized } from "@/lib/http";

function signingKey(raw: Buffer) {
  // RFC 8410 SubjectPublicKeyInfo prefix for a raw 32-byte Ed25519 public key.
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  return createPublicKey({ key: Buffer.concat([prefix, raw]), format: "der", type: "spki" });
}

export async function POST(request: Request) {
  const device = await authenticateDevice(request.headers.get("authorization"));
  if (!device) return unauthorized("The device credential is missing, invalid, or revoked.");
  if (device.paused) {
    return NextResponse.json(
      { error: "device_paused", message: "Resume collection before syncing." },
      { status: 423 }
    );
  }
  if (!device.signing_public_key) {
    return NextResponse.json(
      { error: "unsigned_device", message: "Re-authenticate this device to enable signed sync." },
      { status: 401 }
    );
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
    return NextResponse.json(
      { error: "invalid_signature_time", message: "The signed request timestamp is missing or outside the five-minute window." },
      { status: 401 }
    );
  }
  const compressed = Buffer.from(await request.arrayBuffer());
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
    return NextResponse.json(
      { error: "invalid_signature", message: "The sync batch signature could not be verified." },
      { status: 401 }
    );
  }
  let payload: unknown;
  try {
    const body = request.headers.get("content-encoding") === "gzip"
      ? gunzipSync(compressed)
      : compressed;
    payload = JSON.parse(body.toString("utf8"));
  } catch {
    return NextResponse.json(
      { error: "invalid_payload", message: "The compressed JSON payload could not be decoded." },
      { status: 400 }
    );
  }
  const parsed = syncBatchSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        message: "The request did not match the expected contract.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message
        }))
      },
      { status: 400 }
    );
  }
  const data = parsed.data;
  const receipt = await ingestBatch(device, data);
  return NextResponse.json({
    batch_id: data.batch_id,
    acknowledgement: receipt.acknowledgement,
    accepted: receipt.accepted,
    duplicate: receipt.duplicate,
    rejected: receipt.rejected,
    replay: receipt.replay
  });
}
