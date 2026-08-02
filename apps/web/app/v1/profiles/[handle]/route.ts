import { NextResponse } from "next/server";
import { getProfile } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { notFound } from "@/lib/http";

export async function GET(
  _request: Request,
  context: { params: Promise<{ handle: string }> }
) {
  const { handle } = await context.params;
  const current = await apiViewer();
  const profile = await getProfile(handle, current?.id);
  if (!profile) return notFound();
  return NextResponse.json(profile);
}
