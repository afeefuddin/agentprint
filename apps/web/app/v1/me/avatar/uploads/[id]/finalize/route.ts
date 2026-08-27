import { NextResponse } from "next/server";
import { z } from "zod";
import {
  consumeRateLimit,
  updateProfileAvatar
} from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import {
  MAX_PROFILE_AVATAR_BYTES,
  PROFILE_AVATAR_CONTENT_TYPES,
  hasExpectedProfileAvatarSignature,
  inspectProfileAvatarUpload,
  profileAvatarUploadKey,
  readProfileAvatarSignature,
  removeProfileAvatar,
  removeProfileAvatarUpload
} from "@/lib/avatar-storage";
import { isMissingSpaceObject } from "@/lib/spaces";
import { tooManyRequests, unauthorized } from "@/lib/http";

const allowedContentTypes = new Set<string>(PROFILE_AVATAR_CONTENT_TYPES);

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const current = await apiViewer();
  if (!current) return unauthorized();
  if (!(await consumeRateLimit(`avatar-finalize:${current.id}`, 60, 3600))) {
    return tooManyRequests();
  }

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json({ message: "That profile picture upload was not found." }, { status: 404 });
  }

  let contentType: string;
  try {
    const object = await inspectProfileAvatarUpload(current.id, id);
    contentType = object.contentType;
    if (
      object.contentLength <= 0 ||
      object.contentLength > MAX_PROFILE_AVATAR_BYTES ||
      !allowedContentTypes.has(contentType)
    ) {
      await removeProfileAvatarUpload(current.id, id).catch(() => undefined);
      return NextResponse.json(
        { message: "That image could not be verified. Choose it again." },
        { status: 422 }
      );
    }
  } catch (error) {
    if (isMissingSpaceObject(error)) {
      return NextResponse.json(
        { message: "Your profile picture has not finished uploading. Try again." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { message: "Your profile picture cannot be saved right now. Try again shortly." },
      { status: 503 }
    );
  }

  try {
    const signature = await readProfileAvatarSignature(current.id, id);
    if (!hasExpectedProfileAvatarSignature(contentType, signature)) {
      await removeProfileAvatarUpload(current.id, id).catch(() => undefined);
      return NextResponse.json(
        { message: "That file does not appear to be a valid image." },
        { status: 422 }
      );
    }
  } catch {
    return NextResponse.json(
      { message: "Your profile picture cannot be saved right now. Try again shortly." },
      { status: 503 }
    );
  }

  const objectKey = profileAvatarUploadKey(current.id, id);

  let updatedAt: Date;
  let previousObjectKey: string | null;
  try {
    const updated = await updateProfileAvatar(current.id, contentType, objectKey);
    updatedAt = updated.updatedAt;
    previousObjectKey = updated.previousObjectKey;
  } catch (error) {
    await removeProfileAvatar(objectKey).catch(() => undefined);
    throw error;
  }

  if (previousObjectKey && previousObjectKey !== objectKey) {
    await removeProfileAvatar(previousObjectKey).catch((error: unknown) => {
      console.error("Failed to delete the replaced profile avatar.", error);
    });
  }

  return NextResponse.json({ ok: true, updated_at: updatedAt.toISOString() });
}
