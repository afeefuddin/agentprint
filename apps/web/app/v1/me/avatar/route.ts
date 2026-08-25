import { NextResponse } from "next/server";
import {
  updateProfileAvatar,
  deleteProfileAvatar,
  getProfileAvatarForUser,
  consumeRateLimit
} from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { putProfileAvatar, removeProfileAvatar } from "@/lib/avatar-storage";
import { PayloadTooLargeError } from "@/lib/bounded-gzip";
import { readDeviceRequestBody } from "@/lib/device-request";
import { tooManyRequests, unauthorized } from "@/lib/http";

const MAX_AVATAR_BYTES = 5_242_880;
const MAX_AVATAR_FORM_BYTES = MAX_AVATAR_BYTES + 128 * 1024;
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
  if (!(await consumeRateLimit(`avatar-upload:${current.id}`, 30, 3600))) {
    return tooManyRequests();
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_AVATAR_FORM_BYTES) {
    return NextResponse.json({ message: "Choose an image up to 5 MB." }, { status: 413 });
  }

  let form: FormData;
  try {
    const body = await readDeviceRequestBody(request, MAX_AVATAR_FORM_BYTES);
    form = await new Request(request.url, {
      method: "POST",
      headers: request.headers,
      body: new Uint8Array(body)
    }).formData();
  } catch (error) {
    const tooLarge = error instanceof PayloadTooLargeError;
    return NextResponse.json(
      { message: "Upload an image up to 5 MB using form data." },
      { status: tooLarge ? 413 : 400 }
    );
  }
  const avatar = form.get("avatar");
  if (!(avatar instanceof File)) {
    return NextResponse.json({ message: "Choose an image to upload." }, { status: 400 });
  }
  if (!ALLOWED_IMAGE_TYPES.has(avatar.type)) {
    return NextResponse.json({ message: "Use a JPEG, PNG, or WebP image." }, { status: 415 });
  }
  if (avatar.size === 0 || avatar.size > MAX_AVATAR_BYTES) {
    return NextResponse.json({ message: "Choose an image up to 5 MB." }, { status: 413 });
  }

  const contents = await avatar.arrayBuffer();
  const bytes = new Uint8Array(contents);
  if (!hasExpectedSignature(avatar.type, bytes)) {
    return NextResponse.json({ message: "That file does not appear to be a valid image." }, { status: 400 });
  }

  const previous = await getProfileAvatarForUser(current.id);
  const objectKey = await putProfileAvatar(current.id, avatar.type, contents);
  let updatedAt: Date;
  try {
    updatedAt = await updateProfileAvatar(current.id, avatar.type, objectKey);
  } catch (error) {
    await removeProfileAvatar(objectKey).catch(() => undefined);
    throw error;
  }
  if (previous?.object_key && previous.object_key !== objectKey) {
    await removeProfileAvatar(previous.object_key).catch((error: unknown) => {
      console.error("Failed to delete the replaced profile avatar.", error);
    });
  }
  return NextResponse.json({ ok: true, updated_at: updatedAt.toISOString() });
}

export async function DELETE() {
  const current = await apiViewer();
  if (!current) return unauthorized();
  const avatar = await getProfileAvatarForUser(current.id);
  if (avatar?.object_key) await removeProfileAvatar(avatar.object_key);
  await deleteProfileAvatar(current.id);
  return NextResponse.json({ ok: true });
}
