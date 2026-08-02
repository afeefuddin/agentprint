import { NextResponse } from "next/server";
import { listDevices } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { unauthorized } from "@/lib/http";

export async function GET() {
  const current = await apiViewer();
  if (!current) return unauthorized();
  return NextResponse.json({ devices: await listDevices(current.id) });
}
