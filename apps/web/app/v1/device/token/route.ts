import { NextResponse } from "next/server";
import { z } from "zod";
import { exchangeDeviceCode } from "@agentprint/database";
import { parseJson } from "@/lib/http";

const schema = z.object({ device_code: z.string().min(32) });

export async function POST(request: Request) {
  const { data, response } = await parseJson(request, schema);
  if (response) return response;
  const result = await exchangeDeviceCode(data.device_code);
  if (result.status === "pending") {
    return NextResponse.json({ error: "authorization_pending" }, { status: 428 });
  }
  if (result.status !== "approved") {
    return NextResponse.json({ error: `authorization_${result.status}` }, { status: 400 });
  }
  return NextResponse.json({
    registration_token: result.registrationToken,
    token_type: "device_registration",
    expires_in: 600
  });
}
