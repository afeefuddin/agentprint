import { NextResponse } from "next/server";
import { getProfile } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { unauthorized } from "@/lib/http";

export async function GET() {
  const current = await apiViewer();
  if (!current) return unauthorized();
  return NextResponse.json(await getProfile(current.handle, current.id));
}
