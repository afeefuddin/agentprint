import { NextResponse } from "next/server";
import { friendshipIdSchema } from "@agentprint/contracts";
import { getFriendComparison } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { notFound, unauthorized } from "@/lib/http";

const windows = new Set([7, 30, 90]);

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const current = await apiViewer();
  if (!current) return unauthorized();
  const requestedWindow = Number(new URL(request.url).searchParams.get("window") ?? "30");
  if (!windows.has(requestedWindow)) {
    return NextResponse.json(
      { error: "invalid_request", message: "Comparison window must be 7, 30, or 90 days." },
      { status: 400 }
    );
  }
  const { id } = await context.params;
  if (!friendshipIdSchema.safeParse(id).success) return notFound();
  const comparison = await getFriendComparison(current.id, id, requestedWindow as 7 | 30 | 90);
  if (!comparison) return notFound();
  return NextResponse.json(comparison);
}
