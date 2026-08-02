import { NextResponse } from "next/server";
import { onboardingProfileSchema } from "@agentprint/contracts";
import { completeOnboardingProfile } from "@agentprint/database";
import { apiViewer } from "@/lib/auth";
import { conflict, parseJson, unauthorized } from "@/lib/http";

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
      return conflict("That handle is already taken.");
    }
    throw error;
  }
}
