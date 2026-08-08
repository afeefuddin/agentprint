import { NextResponse } from "next/server";
import { friendRequestSchema } from "@agentprint/contracts";
import { consumeRateLimit, findFriendCandidate } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { notFound, tooManyRequests, unauthorized } from "@/lib/http";

export async function GET(request: Request) {
  const current = await apiViewer();
  if (!current) return unauthorized();
  if (!(await consumeRateLimit(`friend-search:${current.id}`, 60, 60))) {
    return tooManyRequests();
  }
  const parsed = friendRequestSchema.safeParse({ handle: new URL(request.url).searchParams.get("handle") ?? "" });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "Enter an exact Agentprint handle." },
      { status: 400 }
    );
  }
  const candidate = await findFriendCandidate(current.id, parsed.data.handle);
  if (!candidate) return notFound("No profile was found for that exact handle.");
  return NextResponse.json({
    candidate: {
      handle: candidate.handle,
      displayName: candidate.displayName,
      friendshipId: candidate.friendshipId,
      relationship: candidate.relationship,
      direction: candidate.direction
    }
  });
}
