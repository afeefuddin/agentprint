import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createSession, findOrCreateOAuthUser } from "@agentprint/database";
import { sessionCookie } from "@/lib/auth";
import {
  GITHUB_NEXT_COOKIE,
  GITHUB_SOURCE_COOKIE,
  GITHUB_STATE_COOKIE,
  githubIdentity
} from "@/lib/github-oauth";
import { requestUrl } from "@/lib/http";

function finish(request: Request, path: string) {
  const response = NextResponse.redirect(requestUrl(request, path));
  for (const name of [GITHUB_STATE_COOKIE, GITHUB_NEXT_COOKIE, GITHUB_SOURCE_COOKIE]) {
    response.cookies.set(name, "", { path: "/api/auth/github/callback", maxAge: 0 });
  }
  return response;
}

export async function GET(request: Request) {
  const jar = await cookies();
  const params = new URL(request.url).searchParams;
  const source = jar.get(GITHUB_SOURCE_COOKIE)?.value === "register" ? "register" : "login";
  const errorPath = (error: string) => `/${source}?error=${error}`;
  const expectedState = jar.get(GITHUB_STATE_COOKIE)?.value;
  const state = params.get("state");
  const code = params.get("code");

  if (params.has("error")) return finish(request, errorPath("github_denied"));
  if (!expectedState || !state || state !== expectedState) {
    return finish(request, errorPath("github_invalid_state"));
  }
  if (!code) return finish(request, errorPath("github_failed"));

  try {
    const identity = await githubIdentity(code, requestUrl(request, "/api/auth/github/callback").toString());
    const user = await findOrCreateOAuthUser(identity);
    const token = await createSession(user.id);
    const next = jar.get(GITHUB_NEXT_COOKIE)?.value;
    const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : undefined;
    const response = finish(request, user.onboardingComplete ? safeNext ?? "/dashboard" : "/onboarding");
    response.cookies.set(sessionCookie(token));
    return response;
  } catch (error) {
    const reason = error instanceof Error && error.message === "github_verified_email_required"
      ? "github_email_required"
      : "github_failed";
    return finish(request, errorPath(reason));
  }
}
