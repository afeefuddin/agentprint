import { NextResponse } from "next/server";
import { friendshipActionSchema, friendshipIdSchema } from "@agentprint/contracts";
import { actOnFriendship, removeFriendship } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { notFound, parseJson, unauthorized } from "@/lib/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const current = await apiViewer();
  if (!current) return unauthorized();
  const { data, response } = await parseJson(request, friendshipActionSchema);
  if (response) return response;
  const { id } = await context.params;
  if (!friendshipIdSchema.safeParse(id).success) return notFound();
  if (!(await actOnFriendship(current.id, id, data.action))) return notFound();
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const current = await apiViewer();
  if (!current) return unauthorized();
  const { id } = await context.params;
  if (!friendshipIdSchema.safeParse(id).success) return notFound();
  if (!(await removeFriendship(current.id, id))) return notFound();
  return new NextResponse(null, { status: 204 });
}
