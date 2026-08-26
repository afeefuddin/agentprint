import { getProfileAvatar } from "@agentprint/database";
import { profileAvatarUrl } from "@/lib/avatar-storage";
import { apiViewer } from "@/lib/auth";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const current = await apiViewer();
  const avatar = await getProfileAvatar(handle.toLowerCase(), current?.id);
  if (!avatar) return new Response(null, { status: 404 });

  const etag = `"${avatar.updated_at.getTime()}"`;
  if (avatar.object_key) {
    const location = await profileAvatarUrl(avatar.object_key);
    return new Response(null, {
      status: 302,
      headers: {
        location,
        "cache-control": "private, no-store",
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
      "cache-control": "private, no-store",
      etag,
      "x-content-type-options": "nosniff"
    }
  });
}
