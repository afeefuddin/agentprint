import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteAccount } from "@agentprint/database";
import { apiViewer, SESSION_COOKIE } from "@/lib/auth";
import { removeProfileAvatar } from "@/lib/avatar-storage";
import { unauthorized } from "@/lib/http";

export async function DELETE() {
  const current = await apiViewer();
  if (!current) return unauthorized();
  const avatarObjectKey = await deleteAccount(current.id);
  if (avatarObjectKey) {
    await removeProfileAvatar(avatarObjectKey).catch((error: unknown) => {
      console.error("Failed to delete an avatar after its account was removed.", error);
    });
  }
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return new NextResponse(null, { status: 204 });
}
