import { after, NextResponse } from "next/server";
import { cliTelemetrySchema } from "@agentprint/contracts";
import { authenticateDevice, consumeRateLimit } from "@agentprint/database";
import { parseJson, unauthorized } from "@/lib/http";
import { capturePostHogEvent } from "@/lib/posthog-server";

export async function POST(request: Request) {
  const device = await authenticateDevice(request.headers.get("authorization"));
  if (!device) return unauthorized("The device credential is missing, invalid, or revoked.");
  if (!(await consumeRateLimit(`cli-telemetry:${device.id}`, 600, 3600))) {
    return new NextResponse(null, { status: 204 });
  }

  const { data, response } = await parseJson(request, cliTelemetrySchema);
  if (response) return response;

  after(() => capturePostHogEvent({
    distinctId: device.user_id,
    event: data.event,
    properties: { ...data.properties, source: "cli" }
  }));

  return new NextResponse(null, { status: 204 });
}
