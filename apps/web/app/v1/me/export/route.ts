import { NextResponse } from "next/server";
import { usageExport } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { unauthorized } from "@/lib/http";

export async function GET() {
  const current = await apiViewer();
  if (!current) return unauthorized();
  const response = NextResponse.json(await usageExport(current.id));
  response.headers.set(
    "Content-Disposition",
    `attachment; filename="agentprint-${current.handle}-export.json"`
  );
  return response;
}
