import { NextResponse } from "next/server";
import { publicProfileSearchSchema } from "@agentprint/contracts";
import { consumeRateLimit, searchPublicProfiles } from "@agentprint/database";
import { clientAddress, tooManyRequests } from "@/lib/http";

export async function GET(request: Request) {
  const address = clientAddress(request);
  if (!(await consumeRateLimit(`public-profile-search:${address}`, 90, 60))) {
    return tooManyRequests();
  }

  const parsed = publicProfileSearchSchema.safeParse({
    q: new URL(request.url).searchParams.get("q") ?? ""
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_request", message: "Enter at least two characters." },
      { status: 400 }
    );
  }

  return NextResponse.json({ results: await searchPublicProfiles(parsed.data.q) });
}
