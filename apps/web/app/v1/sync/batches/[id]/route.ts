import { NextResponse } from "next/server";
import { authenticateDevice, getSyncBatch } from "@agentprint/database";
import { notFound, unauthorized } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const device = await authenticateDevice(request.headers.get("authorization"));
  if (!device) return unauthorized("The device credential is missing, invalid, or revoked.");
  const { id } = await context.params;
  const receipt = await getSyncBatch(device.id, id);
  if (!receipt) return notFound("That sync receipt does not exist for this device.");
  return NextResponse.json({
    acknowledgement: receipt.id,
    batch_id: receipt.batch_id,
    accepted: receipt.accepted_count,
    duplicate: receipt.duplicate_count,
    rejected: receipt.rejected_count,
    created_at: receipt.created_at
  });
}
