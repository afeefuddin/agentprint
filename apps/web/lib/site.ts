export const SITE_URL = "https://www.agentprint.tech";

export const SITE_NAME = "Agentprint";
export const SITE_DESCRIPTION =
  "Track Claude Code, Codex, OpenCode, and Kimi Code activity from local logs. Build a privacy-first public profile and share redacted coding sessions.";

export function absoluteUrl(path = "/") {
  return new URL(path, `${SITE_URL}/`).toString();
}
