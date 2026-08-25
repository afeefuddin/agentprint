import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteAccount, deleteProfileAvatar, getProfileAvatarForUser } from "@agentprint/database";
import { apiViewer, SESSION_COOKIE } from "@/lib/auth";
import { removeProfileAvatar } from "@/lib/avatar-storage";
import { unauthorized } from "@/lib/http";

export async function DELETE() {
  const current = await apiViewer();
  if (!current) return unauthorized();
  const avatar = await getProfileAvatarForUser(current.id);
  if (avatar?.object_key) {
    await removeProfileAvatar(avatar.object_key);
    await deleteProfileAvatar(current.id);
  }
  await deleteAccount(current.id);
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return new NextResponse(null, { status: 204 });
}
