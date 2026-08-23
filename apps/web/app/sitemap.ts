import type { MetadataRoute } from "next";
import { listIndexablePages } from "@agentprint/database";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const staticPages = [
  { path: "/", lastModified: new Date("2026-08-23") },
  { path: "/privacy", lastModified: new Date("2026-08-23") },
  { path: "/guides/share-codex-session", lastModified: new Date("2026-08-23") },
  { path: "/guides/share-claude-code-session", lastModified: new Date("2026-08-23") },
  { path: "/integrations/claude-code", lastModified: new Date("2026-08-23") },
  { path: "/integrations/codex", lastModified: new Date("2026-08-23") },
  { path: "/integrations/kimi-code", lastModified: new Date("2026-08-23") },
  { path: "/integrations/opencode", lastModified: new Date("2026-08-23") },
  { path: "/docs/getting-started", lastModified: new Date("2026-08-23") }
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = staticPages.map(({ path, lastModified }) => ({
    url: absoluteUrl(path),
    lastModified
  }));

  try {
    const pages = await listIndexablePages();
    entries.push(
      ...pages.profiles.map((profile) => ({
        url: absoluteUrl(`/${encodeURIComponent(profile.handle)}`),
        lastModified: profile.updated_at
      })),
      ...pages.shares.map((share) => ({
        url: absoluteUrl(`/s/${encodeURIComponent(share.slug)}`),
        lastModified: share.updated_at
      }))
    );
  } catch (error) {
    console.error("Unable to add public profiles and sessions to sitemap", error);
  }

  return entries;
}
