const LOCAL_ASSET_PATH = /^\/(?:auth|brand|brands|landing|metrics)\//;

/**
 * Resolve a versioned public asset from DigitalOcean Spaces in deployed
 * environments. Keeping the original public/ files provides a zero-config
 * development path and an immediate rollback if the external origin is unset.
 */
export function assetUrl(path: string) {
  if (!LOCAL_ASSET_PATH.test(path) || path.includes("..")) {
    throw new Error(`invalid_public_asset_path:${path}`);
  }
  const baseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL?.trim().replace(/\/+$/, "");
  return baseUrl ? `${baseUrl}${path}` : path;
}
