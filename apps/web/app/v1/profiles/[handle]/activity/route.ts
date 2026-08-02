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
  const result = await getProfile(handle, current?.id);
  if (!result) return notFound();
  return NextResponse.json({
    activity: result.activity,
    thresholds: result.thresholds,
    summary: result.summary
  });
}
