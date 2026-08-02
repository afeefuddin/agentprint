import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  GOOGLE_NEXT_COOKIE,
  GOOGLE_SOURCE_COOKIE,
  GOOGLE_STATE_COOKIE,
  googleCredentials
} from "@/lib/google-oauth";
import { requestUrl } from "@/lib/http";

const oauthCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/auth/google/callback",
  maxAge: 60 * 10
};

export async function GET(request: Request) {
  const credentials = googleCredentials();
  const requestParams = new URL(request.url).searchParams;
  const source = requestParams.get("source") === "register" ? "register" : "login";
  if (!credentials) {
    return NextResponse.redirect(requestUrl(request, `/${source}?error=google_not_configured`));
  }

  const state = randomBytes(32).toString("base64url");
  const next = requestParams.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "";
  const callbackUrl = requestUrl(request, "/api/auth/google/callback").toString();
  const authorizeUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorizeUrl.searchParams.set("client_id", credentials.clientId);
  authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("scope", "openid profile email");
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(GOOGLE_STATE_COOKIE, state, oauthCookie);
  response.cookies.set(GOOGLE_NEXT_COOKIE, safeNext, oauthCookie);
  response.cookies.set(GOOGLE_SOURCE_COOKIE, source, oauthCookie);
  return response;
}
