import { after, NextResponse } from "next/server";
import { auditShareForCredentials, sessionShareSchema } from "@agentprint/contracts";
import { consumeRateLimit, listShares, publishShare } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { contractFailure, readSignedDeviceRequest, resolveOwner } from "@/lib/device-request";
import { requestUrl, tooManyRequests, unauthorized } from "@/lib/http";
import { capturePostHogEvent } from "@/lib/posthog-server";

export async function GET(request: Request) {
  const owner = await resolveOwner(request, apiViewer);
  if (!owner) return unauthorized();
  return NextResponse.json({ shares: await listShares(owner.id) });
}

export async function POST(request: Request) {
  const { device, payload, response } = await readSignedDeviceRequest(request, {
    maxBytes: 8 * 1024 * 1024
  });
  if (response) return response;
  if (!(await consumeRateLimit(`share:${device.user_id}`, 60, 3600))) {
    return tooManyRequests();
  }
  const parsed = sessionShareSchema.safeParse(payload);
  if (!parsed.success) return contractFailure(parsed.error.issues);
  const share = parsed.data;

  /*
   * The collector redacts before upload. This is the server-side backstop, so
   * a modified or third-party client cannot publish obvious credentials. It
   * refuses the publish rather than silently scrubbing, because the owner
   * should know their transcript still contains a live secret.
   */
  const credentials = auditShareForCredentials(share);
  if (credentials.length > 0) {
    return NextResponse.json(
      {
        error: "credentials_detected",
        message:
          "The transcript still contains values that look like live credentials. Publishing was refused.",
        detected: credentials
      },
      { status: 422 }
    );
  }

  const result = await publishShare(
    { userId: device.user_id, deviceId: device.id },
    share
  );
  after(() => capturePostHogEvent({
    distinctId: device.user_id,
    event: "session_share_published",
    properties: {
      visibility: share.visibility,
      redaction_level: share.redaction_level,
      replaced: result.replaced,
      turn_count: share.turns.length,
      model_count: share.model_ids.length
    }
  }));
  return NextResponse.json(
    {
      id: result.id,
      slug: result.slug,
      url: requestUrl(request, `/s/${result.slug}`).toString(),
      visibility: share.visibility,
      replaced: result.replaced
    },
    { status: result.replaced ? 200 : 201 }
  );
}
