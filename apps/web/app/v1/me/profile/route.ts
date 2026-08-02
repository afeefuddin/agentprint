import { NextResponse } from "next/server";
import { profilePatchSchema } from "@agentprint/contracts";
import { updateProfile } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { parseJson, unauthorized } from "@/lib/http";

export async function PATCH(request: Request) {
  const current = await apiViewer();
  if (!current) return unauthorized();
  const { data, response } = await parseJson(request, profilePatchSchema);
  if (response) return response;
  await updateProfile(current.id, data);
  return NextResponse.json({ ok: true });
}
