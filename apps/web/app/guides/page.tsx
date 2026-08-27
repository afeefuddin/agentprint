import type { Metadata } from "next";
import { ContentHubPage } from "@/components/content-hub-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Coding agent session sharing guides",
  description: "Practical guides for previewing, redacting, publishing, and revoking selected Claude Code, Codex, and Kimi Code sessions.",
  alternates: { canonical: absoluteUrl("/guides") }
};

const items = [
  { href: "/guides/share-claude-code-session", title: "Share a Claude Code session", description: "Choose one local session, inspect the redacted preview, and publish a revocable link.", label: "Guide", mark: "/brands/claude.svg", tone: "blue" as const },
  { href: "/guides/share-codex-session", title: "Share a Codex session", description: "Turn a selected Codex CLI session into a readable link without enabling background transcript uploads.", label: "Guide", mark: "/brands/codex.svg" },
  { href: "/guides/share-kimi-code-session", title: "Share a Kimi Code session", description: "Preview a Kimi Code transcript locally, choose a redaction level, and control who can open it.", label: "Guide", mark: "/brands/kimi.svg", tone: "ink" as const },
  { href: "/security/session-redaction", title: "Understand session redaction", description: "See which credential shapes, paths, images, and tool details are removed before publishing.", label: "Security" },
  { href: "/docs/getting-started", title: "Install Agentprint", description: "Create a profile, connect a machine, and confirm which supported coding tools were found.", label: "Documentation" },
  { href: "/privacy/what-agentprint-collects", title: "Separate tracking from sharing", description: "Learn why numeric background activity and deliberately published transcripts use different boundaries.", label: "Methodology" }
];

export default function GuidesPage() {
  return <ContentHubPage
    eyebrow="Agentprint guides"
    title="Share the session you mean to share. Nothing else."
    intro="Follow exact, local-first workflows for selecting a coding session, reviewing the final payload, choosing its audience, and breaking the link later."
    items={items}
    featured={items[0]}
    footnote="Start with your coding agent, then move into the redaction and privacy documentation when you need to inspect the boundary in detail."
  />;
}
