import { NextResponse } from "next/server";
import { auditSharePatchForCredentials, sharePatchSchema } from "@agentprint/contracts";
import { revokeShare, updateShare } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { resolveOwner } from "@/lib/device-request";
import { notFound, parseJson, unauthorized } from "@/lib/http";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const current = await apiViewer();
  if (!current) return unauthorized();
  const { id } = await context.params;
  const { data, response } = await parseJson(request, sharePatchSchema);
  if (response) return response;
  const credentials = auditSharePatchForCredentials(data);
  if (credentials.length > 0) {
    return NextResponse.json(
      {
        error: "credentials_detected",
        message: "The session title contains values that look like live credentials. Updating it was refused.",
        detected: credentials
      },
      { status: 422 }
    );
  }
  const share = await updateShare(current.id, id, data);
  if (!share) return notFound("That shared session was not found.");
  return NextResponse.json(share);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const owner = await resolveOwner(request, apiViewer);
  if (!owner) return unauthorized();
  const { id } = await context.params;
  if (!(await revokeShare(owner.id, id))) {
    return notFound("That shared session was not found.");
  }
  return new NextResponse(null, { status: 204 });
}
