import { NextResponse } from "next/server";
import { z } from "zod";
import { approveDeviceCode } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { parseJson, unauthorized } from "@/lib/http";

const schema = z.object({ user_code: z.string().regex(/^[A-F0-9]{6}-[A-F0-9]{6}$/i) });

export async function POST(request: Request) {
  const current = await apiViewer();
  if (!current) return unauthorized();
  const { data, response } = await parseJson(request, schema);
  if (response) return response;
  const approved = await approveDeviceCode(data.user_code, current.id);
  if (!approved) {
    return NextResponse.json(
      { error: "invalid_code", message: "This code is invalid, expired, or already used." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
