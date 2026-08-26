import { NextResponse } from "next/server";
import { listSessionShareAttempts, listShares } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { resolveOwner } from "@/lib/device-request";
import { unauthorized } from "@/lib/http";

export async function GET(request: Request) {
  const owner = await resolveOwner(request, apiViewer);
  if (!owner) return unauthorized();
  const [shares, attempts] = await Promise.all([
    listShares(owner.id),
    listSessionShareAttempts(owner.id)
  ]);
  return NextResponse.json({ shares, attempts });
}

export async function POST() {
  return NextResponse.json(
    {
      error: "client_upgrade_required",
      message: "Update Agentprint to publish sessions through the protected upload flow."
    },
    { status: 426 }
  );
}
