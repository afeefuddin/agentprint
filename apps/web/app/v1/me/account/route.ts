import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { deleteAccount } from "@agentprint/database";
import { apiViewer, SESSION_COOKIE } from "@/lib/auth";
import { unauthorized } from "@/lib/http";

export async function DELETE() {
  const current = await apiViewer();
  if (!current) return unauthorized();
  await deleteAccount(current.id);
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return new NextResponse(null, { status: 204 });
}
