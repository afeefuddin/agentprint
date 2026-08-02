import { NextResponse } from "next/server";
import { authenticateDevice, revokeAuthenticatedDevice } from "@agentprint/database";
import { unauthorized } from "@/lib/http";

export async function DELETE(request: Request) {
  const device = await authenticateDevice(request.headers.get("authorization"));
  if (!device) return unauthorized("The device credential is missing, invalid, or revoked.");
  await revokeAuthenticatedDevice(device.id);
  return new NextResponse(null, { status: 204 });
}
