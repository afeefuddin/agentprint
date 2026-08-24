import { getProfileAvatar } from "@agentprint/database";
import { profileAvatarUrl } from "@/lib/avatar-storage";

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

  if (avatar.object_key) {
    const location = await profileAvatarUrl(avatar.object_key);
    return new Response(null, {
      status: 302,
      headers: {
        location,
        "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
        etag,
        "x-content-type-options": "nosniff"
      }
    });
  }

  const bytes = new Uint8Array(avatar.image_data!);
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);

  return new Response(body, {
    headers: {
      "content-type": avatar.content_type,
      "cache-control": "public, max-age=3600, stale-while-revalidate=86400",
      etag,
      "x-content-type-options": "nosniff"
    }
  });
}
