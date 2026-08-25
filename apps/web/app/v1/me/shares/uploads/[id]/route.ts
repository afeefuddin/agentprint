import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionShareUploadStatusForOwner } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { resolveOwner } from "@/lib/device-request";
import { requestUrl, unauthorized } from "@/lib/http";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const owner = await resolveOwner(request, apiViewer);
  if (!owner) return unauthorized();

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return NextResponse.json(
      { error: "upload_not_found", message: "That session upload was not found." },
      { status: 404 }
    );
  }
  const upload = await getSessionShareUploadStatusForOwner(id, owner.id);
  if (!upload) {
    return NextResponse.json(
      { error: "upload_not_found", message: "That session upload was not found." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    upload_id: upload.id,
    status: upload.status,
    failure_code: upload.failure_code,
    share_id: upload.share_id,
    share_url: upload.share_slug
      ? requestUrl(request, `/s/${upload.share_slug}`).toString()
      : null,
    expires_at: upload.expires_at.toISOString()
  });
}
