import { after, NextResponse } from "next/server";
import { ingestBatch } from "@agentprint/database";
import { syncBatchSchema } from "@agentprint/contracts";
import { contractFailure, readSignedDeviceRequest } from "@/lib/device-request";
import { capturePostHogEvent } from "@/lib/posthog-server";

export async function POST(request: Request) {
  const { device, payload, response } = await readSignedDeviceRequest(request, {
    requireUnpaused: true
  });
  if (response) return response;
  const parsed = syncBatchSchema.safeParse(payload);
  if (!parsed.success) return contractFailure(parsed.error.issues);
  const data = parsed.data;
  const receipt = await ingestBatch(device, data);
  after(() => capturePostHogEvent({
    distinctId: device.user_id,
    event: "sync_completed",
    properties: {
      accepted: receipt.accepted,
      duplicate: receipt.duplicate,
      rejected: receipt.rejected,
      replay: receipt.replay,
      record_count: data.records.length
    }
  }));
  return NextResponse.json({
    batch_id: data.batch_id,
    acknowledgement: receipt.acknowledgement,
    accepted: receipt.accepted,
    duplicate: receipt.duplicate,
    rejected: receipt.rejected,
    replay: receipt.replay
  });
}
