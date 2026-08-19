import { NextResponse } from "next/server";
import { getSharedSession } from "@agentprint/database";
import { viewer } from "@/lib/auth";
import { notFound } from "@/lib/http";

const maxPageSize = 500;

export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> }
) {
  const { slug } = await context.params;
  const url = new URL(request.url);
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);
  const limit = Math.min(
    maxPageSize,
    Math.max(1, Number(url.searchParams.get("limit") ?? maxPageSize) || maxPageSize)
  );
  const current = await viewer();
  const share = await getSharedSession(slug, current?.id, { offset, limit });
  if (!share) return notFound("That shared session is not available.");
  // user_id is the internal owner reference and never leaves the server.
  const { user_id, handle, display_name, is_public, ...body } = share;
  void user_id;
  const response = NextResponse.json({
    ...body,
    author: { handle, display_name, is_public },
    page: { offset, limit, has_more: offset + share.turns.length < share.turn_count }
  });
  // Unlisted and friends-only links must never enter a search index.
  if (share.visibility !== "public") {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}
