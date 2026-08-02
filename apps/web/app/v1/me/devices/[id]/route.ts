import { NextResponse } from "next/server";
import { revokeDevice } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { notFound, unauthorized } from "@/lib/http";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const current = await apiViewer();
  if (!current) return unauthorized();
  const { id } = await context.params;
  if (!(await revokeDevice(current.id, id))) return notFound();
  return new NextResponse(null, { status: 204 });
}
