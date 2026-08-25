import type { Metadata } from "next";
import { ContentHubPage } from "@/components/content-hub-page";
import { absoluteUrl } from "@/lib/site";
import { assetUrl } from "@/lib/assets";

export const metadata: Metadata = {
  title: "Coding agent integrations",
  description: "Track Claude Code, Codex, OpenCode, and Kimi Code activity from local records in one privacy-controlled Agentprint profile.",
  alternates: { canonical: absoluteUrl("/integrations") }
};

const items = [
  { href: "/integrations/claude-code", title: "Claude Code activity tracking", description: "Turn historical Claude Code activity into a year-long profile without uploading prompts or source code.", label: "Integration", mark: assetUrl("/brands/claude.svg"), tone: "blue" as const },
  { href: "/integrations/codex", title: "Codex activity tracking", description: "Bring Codex dates, token totals, and model activity into the same durable history.", label: "Integration", mark: assetUrl("/brands/codex.svg") },
  { href: "/integrations/opencode", title: "OpenCode activity tracking", description: "Add OpenCode usage metadata to your profile while keeping session content on your machine.", label: "Integration", mark: assetUrl("/brands/opencode.svg") },
  { href: "/integrations/kimi-code", title: "Kimi Code activity tracking", description: "Keep Kimi Code activity visible beside the other coding agents you use.", label: "Integration", mark: assetUrl("/brands/kimi.svg"), tone: "ink" as const },
  { href: "/use-cases/ai-coding-activity-tracker", title: "One tracker across coding agents", description: "See why a cross-agent history answers a different question from a quota or billing monitor.", label: "Use case" },
  { href: "/privacy/what-agentprint-collects", title: "What each integration collects", description: "Inspect the exact boundary between numeric activity and the substance of your work.", label: "Methodology" }
];

export default function IntegrationsPage() {
  return <ContentHubPage
    eyebrow="Agentprint integrations"
    title="One activity history for the coding agents you actually use."
    intro="Connect Claude Code, Codex, OpenCode, and Kimi Code without maintaining a separate public profile for every tool. Agentprint normalizes local activity into one history you control."
    items={items}
    featured={items[0]}
    footnote="Choose a coding agent to see the exact local source, supported workflow, privacy boundary, and current limitations."
  />;
}
