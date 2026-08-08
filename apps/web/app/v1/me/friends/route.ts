import { NextResponse } from "next/server";
import { friendRequestSchema } from "@agentprint/contracts";
import { consumeRateLimit, listFriendships, sendFriendRequest } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { conflict, notFound, parseJson, tooManyRequests, unauthorized } from "@/lib/http";

export async function GET() {
  const current = await apiViewer();
  if (!current) return unauthorized();
  return NextResponse.json(await listFriendships(current.id));
}

export async function POST(request: Request) {
  const current = await apiViewer();
  if (!current) return unauthorized();
  if (!(await consumeRateLimit(`friend-request:${current.id}`, 20, 3600))) {
    return tooManyRequests();
  }
  const { data, response } = await parseJson(request, friendRequestSchema);
  if (response) return response;
  const result = await sendFriendRequest(current.id, data.handle);
  if (result.status === "not_found") return notFound("No profile was found for that exact handle.");
  if (result.status === "exists") {
    if (result.candidate?.direction === "incoming") {
      return conflict("This person has already sent you a friend request.");
    }
    return conflict("A friendship or pending request already exists.");
  }
  return NextResponse.json({ id: result.id }, { status: 201 });
}
