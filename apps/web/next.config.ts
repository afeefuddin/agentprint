import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  transpilePackages: [
    "@agentprint/analytics",
    "@agentprint/contracts",
    "@agentprint/database"
  ],
  experimental: {
    optimizePackageImports: ["lucide-react"]
  },
  async redirects() {
    return [{
      source: "/releases/latest/:artifact*",
      destination: "https://github.com/afeefuddin/agentprint/releases/latest/download/:artifact*",
      permanent: false
    }];
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
