import type { NextConfig } from "next";

const publicAssetBaseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL?.trim();
const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];
if (publicAssetBaseUrl) {
  const assetOrigin = new URL(publicAssetBaseUrl);
  if (assetOrigin.protocol !== "https:" && assetOrigin.protocol !== "http:") {
    throw new Error("NEXT_PUBLIC_ASSET_BASE_URL must use http or https.");
  }
  if (assetOrigin.search || assetOrigin.hash) {
    throw new Error("NEXT_PUBLIC_ASSET_BASE_URL cannot contain a query string or fragment.");
  }
  remotePatterns.push({
    protocol: assetOrigin.protocol === "https:" ? "https" : "http",
    hostname: assetOrigin.hostname,
    port: assetOrigin.port,
    pathname: `${assetOrigin.pathname.replace(/\/+$/, "")}/**`
  });
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  images: { remotePatterns },
  transpilePackages: [
    "@agentprint/analytics",
    "@agentprint/contracts",
    "@agentprint/database"
  ],
  experimental: {
    optimizePackageImports: ["lucide-react"]
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" }
      ]
    }];
  }
};

export default nextConfig;
