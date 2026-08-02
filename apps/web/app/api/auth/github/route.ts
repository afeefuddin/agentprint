import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  GITHUB_NEXT_COOKIE,
  GITHUB_SOURCE_COOKIE,
  GITHUB_STATE_COOKIE,
  githubCredentials
} from "@/lib/github-oauth";
import { requestUrl } from "@/lib/http";

const oauthCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth/github/callback",
  maxAge: 60 * 10
};

export async function GET(request: Request) {
  const credentials = githubCredentials();
  const requestParams = new URL(request.url).searchParams;
  const source = requestParams.get("source") === "register" ? "register" : "login";
  if (!credentials) {
    return NextResponse.redirect(requestUrl(request, `/${source}?error=github_not_configured`));
  }

  const state = randomBytes(32).toString("base64url");
  const next = requestParams.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "";
  const callbackUrl = requestUrl(request, "/api/auth/github/callback").toString();
  const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", credentials.clientId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizeUrl.searchParams.set("scope", "user:email");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(GITHUB_STATE_COOKIE, state, oauthCookie);
  response.cookies.set(GITHUB_NEXT_COOKIE, safeNext, oauthCookie);
  response.cookies.set(GITHUB_SOURCE_COOKIE, source, oauthCookie);
  return response;
}
