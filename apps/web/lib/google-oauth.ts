export const GOOGLE_STATE_COOKIE = "pm_google_state";
export const GOOGLE_NEXT_COOKIE = "pm_google_next";
export const GOOGLE_SOURCE_COOKIE = "pm_google_source";

type GoogleUser = {
  sub: string;
  email: string;
  email_verified: boolean;
};

export function googleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export async function googleIdentity(code: string, redirectUri: string) {
  const credentials = googleCredentials();
  if (!credentials) throw new Error("google_not_configured");

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    }),
    cache: "no-store"
  });
  const tokenBody = await tokenResponse.json() as { access_token?: string };
  if (!tokenResponse.ok || !tokenBody.access_token) throw new Error("google_token_exchange_failed");

  const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    cache: "no-store"
  });
  if (!userResponse.ok) throw new Error("google_profile_failed");
  const user = await userResponse.json() as GoogleUser;
  if (!user.sub || !user.email || !user.email_verified) throw new Error("google_verified_email_required");

  return { provider: "google" as const, accountId: user.sub, email: user.email };
}
