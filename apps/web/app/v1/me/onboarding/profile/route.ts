import { NextResponse } from "next/server";
import { onboardingProfileSchema } from "@agentprint/contracts";
import { completeOnboardingProfile, consumeRateLimit, isProfileHandleAvailable } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { conflict, parseJson, tooManyRequests, unauthorized } from "@/lib/http";

export async function GET(request: Request) {
  const current = await apiViewer();
  if (!current) return unauthorized();
  if (!(await consumeRateLimit(`handle-availability:${current.id}`, 120, 60))) {
    return tooManyRequests();
  }

  const handle = new URL(request.url).searchParams.get("handle")?.toLowerCase() ?? "";
  const parsed = onboardingProfileSchema.shape.handle.safeParse(handle);
  if (!parsed.success) return NextResponse.json({ available: false });

  const available = await isProfileHandleAvailable(current.id, parsed.data);
  return NextResponse.json({ available });
}

export async function POST(request: Request) {
  const current = await apiViewer();
  if (!current) return unauthorized();
  const { data, response } = await parseJson(request, onboardingProfileSchema);
  if (response) return response;

  try {
    const completed = await completeOnboardingProfile(current.id, data);
    if (!completed) return conflict("Profile setup has already been completed.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (
      typeof error === "object" && error && "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      return NextResponse.json({ error: "handle_taken" }, { status: 409 });
    }
    throw error;
  }
}
