const GITHUB_API = "https://api.github.com";

export const GITHUB_STATE_COOKIE = "pm_github_state";
export const GITHUB_NEXT_COOKIE = "pm_github_next";
export const GITHUB_SOURCE_COOKIE = "pm_github_source";

type GithubUser = {
  id: number;
  login: string;
};

type GithubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
};

export function githubCredentials() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export async function githubIdentity(code: string, redirectUri: string) {
  const credentials = githubCredentials();
  if (!credentials) throw new Error("github_not_configured");

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      code,
      redirect_uri: redirectUri
    }),
    cache: "no-store"
  });
  const tokenBody = await tokenResponse.json() as { access_token?: string; error?: string };
  if (!tokenResponse.ok || !tokenBody.access_token) throw new Error("github_token_exchange_failed");

  const headers = {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${tokenBody.access_token}`,
    "X-GitHub-Api-Version": "2026-03-10"
  };
  const [userResponse, emailsResponse] = await Promise.all([
    fetch(`${GITHUB_API}/user`, { headers, cache: "no-store" }),
    fetch(`${GITHUB_API}/user/emails`, { headers, cache: "no-store" })
  ]);
  if (!userResponse.ok || !emailsResponse.ok) throw new Error("github_profile_failed");

  const user = await userResponse.json() as GithubUser;
  const emails = await emailsResponse.json() as GithubEmail[];
  const email = emails.find((candidate) => candidate.primary && candidate.verified)
    ?? emails.find((candidate) => candidate.verified);
  if (!user.id || !user.login || !email) throw new Error("github_verified_email_required");

  return {
    provider: "github" as const,
    accountId: String(user.id),
    email: email.email
  };
}
