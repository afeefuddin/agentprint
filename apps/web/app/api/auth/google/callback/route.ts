import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { createSession, findOrCreateOAuthUser } from "@agentprint/database";
import { sessionCookie } from "@/lib/auth";
import {
  GOOGLE_NEXT_COOKIE,
  GOOGLE_SOURCE_COOKIE,
  GOOGLE_STATE_COOKIE,
  googleIdentity
} from "@/lib/google-oauth";
import { requestUrl } from "@/lib/http";
import { capturePostHogEvent } from "@/lib/posthog-server";

function finish(request: Request, path: string) {
  const response = NextResponse.redirect(requestUrl(request, path));
  for (const name of [GOOGLE_STATE_COOKIE, GOOGLE_NEXT_COOKIE, GOOGLE_SOURCE_COOKIE]) {
    response.cookies.set(name, "", { path: "/api/auth/google/callback", maxAge: 0 });
  }
  return response;
}

export async function GET(request: Request) {
  const jar = await cookies();
  const params = new URL(request.url).searchParams;
  const source = jar.get(GOOGLE_SOURCE_COOKIE)?.value === "register" ? "register" : "login";
  const errorPath = (error: string) => `/${source}?error=${error}`;
  const expectedState = jar.get(GOOGLE_STATE_COOKIE)?.value;
  const state = params.get("state");
  const code = params.get("code");

  if (params.has("error")) return finish(request, errorPath("google_denied"));
  if (!expectedState || !state || state !== expectedState) {
    return finish(request, errorPath("google_invalid_state"));
  }
  if (!code) return finish(request, errorPath("google_failed"));

  try {
    const identity = await googleIdentity(code, requestUrl(request, "/api/auth/google/callback").toString());
    const user = await findOrCreateOAuthUser(identity);
    const token = await createSession(user.id);
    const next = jar.get(GOOGLE_NEXT_COOKIE)?.value;
    const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;
    const response = finish(request, user.onboardingComplete ? safeNext ?? `/${user.handle}` : "/onboarding");
    response.cookies.set(sessionCookie(token));
    after(() => capturePostHogEvent({
      distinctId: user.id,
      event: "account_signed_in",
      properties: { provider: "google", source }
    }));
    return response;
  } catch (error) {
    const reason = error instanceof Error && error.message === "google_verified_email_required"
      ? "google_email_required"
      : "google_failed";
    return finish(request, errorPath(reason));
  }
}
