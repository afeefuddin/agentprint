export const PUBLIC_ASSET_PATHS = [
  "/auth/agentprint-trace-field.webp",
  "/brand/agentprint-lockup.svg",
  "/brand/agentprint-mark.svg",
  "/brands/claude.svg",
  "/brands/codex.svg",
  "/brands/github.svg",
  "/brands/glm.svg",
  "/brands/kimi.svg",
  "/brands/opencode.svg",
  "/brands/qwen.svg",
  "/landing/sessions-to-heatmap.webp",
  "/metrics/generated/active-days.png",
  "/metrics/generated/current-streak.png",
  "/metrics/generated/lifetime-tokens.png",
  "/metrics/generated/longest-streak.png"
] as const;

const publicAssetPaths = new Set<string>(PUBLIC_ASSET_PATHS);

/**
 * Resolve a versioned public asset from DigitalOcean Spaces in deployed
 * environments. Keeping the original public/ files provides a zero-config
 * development path and an immediate rollback if the external origin is unset.
 */
export function assetUrl(path: string) {
  if (!publicAssetPaths.has(path)) {
    throw new Error(`invalid_public_asset_path:${path}`);
  }
  const baseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL?.trim().replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}${path}` : path;
}
