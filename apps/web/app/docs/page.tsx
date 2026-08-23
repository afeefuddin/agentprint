import type { Metadata } from "next";
import { ContentHubPage } from "@/components/content-hub-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Agentprint documentation",
  description: "Install Agentprint, connect supported coding agents, understand activity collection, and safely share selected sessions.",
  alternates: { canonical: absoluteUrl("/docs") }
};

const items = [
  { href: "/docs/getting-started", title: "Getting started", description: "Create your profile, install the CLI, connect a machine, and complete your first activity sync.", label: "Documentation", tone: "blue" as const },
  { href: "/integrations", title: "Supported coding agents", description: "Check tracking and session-sharing support for Claude Code, Codex, OpenCode, and Kimi Code.", label: "Integration" },
  { href: "/methodology/activity", title: "Activity methodology", description: "Understand how local records become normalized, idempotent daily activity without conversation content.", label: "Methodology" },
  { href: "/security/session-redaction", title: "Session redaction", description: "Inspect the local preview, credential checks, path rewriting, redaction levels, and server backstop.", label: "Security", tone: "ink" as const },
  { href: "/privacy/what-agentprint-collects", title: "Collection boundary", description: "See exactly what automatic tracking accepts and what it is designed to reject.", label: "Methodology" },
  { href: "/guides", title: "Session sharing guides", description: "Use practical walkthroughs for publishing and revoking selected coding-agent sessions.", label: "Guide" }
];

export default function DocsPage() {
  return <ContentHubPage
    eyebrow="Agentprint documentation"
    title="From first install to a profile you can explain."
    intro="Use the shortest path to get connected, then go deeper into the collection, privacy, and sharing decisions behind the product."
    items={items}
    featured={items[0]}
    footnote="The docs describe current behavior and current limitations. Every path leads back to a concrete command, product surface, or enforcement boundary."
  />;
}
