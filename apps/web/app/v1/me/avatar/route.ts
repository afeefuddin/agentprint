import { NextResponse } from "next/server";
import { updateProfileAvatar, deleteProfileAvatar } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { unauthorized } from "@/lib/http";

const MAX_AVATAR_BYTES = 1_048_576;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function hasExpectedSignature(type: string, bytes: Uint8Array) {
  if (type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  }
  return bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
}

export async function POST(request: Request) {
  const current = await apiViewer();
  if (!current) return unauthorized();

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ message: "Upload an image using form data." }, { status: 400 });
  }
  const avatar = form.get("avatar");
  if (!(avatar instanceof File)) {
    return NextResponse.json({ message: "Choose an image to upload." }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.has(avatar.type)) {
    return NextResponse.json({ message: "Use a JPEG, PNG, or WebP image." }, { status: 415 });
  }
  if (avatar.size === 0 || avatar.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ message: "Choose an image smaller than 1 MB." }, { status: 413 });
  }

  const bytes = new Uint8Array(await avatar.arrayBuffer());
  if (!hasExpectedSignature(avatar.type, bytes)) {
    return NextResponse.json({ message: "That file does not appear to be a valid image." }, { status: 400 });
  }

  const updatedAt = await updateProfileAvatar(current.id, avatar.type, Buffer.from(bytes));
  return NextResponse.json({ ok: true, updated_at: updatedAt.toISOString() });
}

export async function DELETE() {
  const current = await apiViewer();
  if (!current) return unauthorized();
  await deleteProfileAvatar(current.id);
  return NextResponse.json({ ok: true });
}
