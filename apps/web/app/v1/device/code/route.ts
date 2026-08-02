import { NextResponse } from "next/server";
import { z } from "zod";
import { consumeRateLimit, createDeviceCode } from "@agentprint/database";
import { clientAddress, parseJson, tooManyRequests } from "@/lib/http";

const schema = z.object({
  client_name: z.string().trim().min(1).max(100).default("Agentprint CLI")
});

export async function POST(request: Request) {
  if (!(await consumeRateLimit(`device-code:${clientAddress(request)}`, 30, 600))) {
    return tooManyRequests();
  }
  const { data, response } = await parseJson(request, schema);
  if (response) return response;
  const code = await createDeviceCode(data.client_name);
  const appUrl = process.env.APP_URL ?? "http://localhost:3000";
  return NextResponse.json({
    device_code: code.deviceCode,
    user_code: code.userCode,
    verification_uri: `${appUrl}/activate`,
    verification_uri_complete: `${appUrl}/activate?code=${code.userCode}`,
    expires_in: code.expiresIn,
    interval: code.interval
  });
}
