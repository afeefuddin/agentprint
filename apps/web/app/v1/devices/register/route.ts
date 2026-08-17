import { NextResponse } from "next/server";
import { z } from "zod";
import { registerDevice } from "@agentprint/database";
import { parseJson, unauthorized } from "@/lib/http";

const schema = z.object({
  registration_token: z.string().min(32),
  name: z.string().trim().min(1).max(100),
  platform: z.string().min(1).max(80),
  agent_version: z.string().min(1).max(40),
  signing_public_key: z.string().regex(/^[A-Za-z0-9+/]{43}=$/),
  sources: z.array(z.object({
    harness_id: z.enum(["codex", "claude-code", "opencode", "kimi-code", "synthetic"]),
    version: z.string().max(80).optional()
  })).max(20)
});

export async function POST(request: Request) {
  const { data, response } = await parseJson(request, schema);
  if (response) return response;
  const result = await registerDevice({
    registrationToken: data.registration_token,
    name: data.name,
    platform: data.platform,
    agentVersion: data.agent_version,
    signingPublicKey: data.signing_public_key,
    sources: data.sources.map((source) => ({
      harnessId: source.harness_id,
      version: source.version
    }))
  });
  if (!result) return unauthorized("The registration token is invalid or expired.");
  return NextResponse.json({
    device_id: result.deviceId,
    access_token: result.credential,
    token_type: "Bearer"
  }, { status: 201 });
}
