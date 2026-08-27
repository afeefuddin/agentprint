import { NextResponse } from "next/server";
import {
  deleteProfileAvatar,
  getProfileAvatarForUser
} from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { removeProfileAvatar } from "@/lib/avatar-storage";
import { unauthorized } from "@/lib/http";

export async function DELETE() {
  const current = await apiViewer();
  if (!current) return unauthorized();
  const avatar = await getProfileAvatarForUser(current.id);
  if (avatar?.object_key) await removeProfileAvatar(avatar.object_key);
  await deleteProfileAvatar(current.id);
  return NextResponse.json({ ok: true });
}
