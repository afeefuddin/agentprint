import { getProfileAvatar } from "@agentprint/database";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const avatar = await getProfileAvatar(handle.toLowerCase());
  if (!avatar) return new Response(null, { status: 404 });

  const etag = `"${avatar.updated_at.getTime()}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { etag } });
  }

  return new Response(new Uint8Array(avatar.image_data), {
    headers: {
      "content-type": avatar.content_type,
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      etag,
      "x-content-type-options": "nosniff"
    }
  });
}
