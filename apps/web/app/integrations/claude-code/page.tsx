import type { Metadata } from "next";
import { SeoContentPage } from "@/components/seo-content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Claude Code usage tracker and activity dashboard",
  description: "Track historical Claude Code token activity from local logs and turn it into a privacy-controlled Agentprint profile. Not a quota or billing monitor.",
  alternates: { canonical: absoluteUrl("/integrations/claude-code") }
};

export default function ClaudeCodeIntegrationPage() {
  return <SeoContentPage
    eyebrow="Claude Code integration"
    title="A Claude Code activity tracker built around local logs."
    intro="Agentprint turns Claude Code token metadata into a year-long activity field, model mix, streaks, and a public profile whose visibility you control."
    qualifier="Agentprint tracks historical coding activity. It does not report remaining Claude plan quota, reset windows, or provider billing."
    agent="claude"
    mode="tracking"
    outcomeTitle="See the shape of your Claude Code practice."
    outcomeBody="Keep a durable record across individual terminal sessions, then decide which totals, harnesses, models, and streaks belong on your public profile."
    steps={[
      { title: "Connect the local collector", body: "Device-code login authorizes one machine without asking for your Claude account password.", command: "agentprint login" },
      { title: "Collect numeric usage metadata", body: "Agentprint discovers the Claude Code source and syncs date, token counts, harness, and model through a strict schema.", command: "agentprint sync" },
      { title: "Shape your public profile", body: "Keep the profile private, publish it, or hide individual metric groups from visitors while preserving your own view." }
    ]}
    principles={[
      { title: "No transcript in background sync", body: "The normal ingestion contract has no prompt, response, source-code, repository-name, or local-path fields." },
      { title: "Idempotent collection", body: "Stable event identities let repeated syncs acknowledge duplicates without inflating the activity field." },
      { title: "Per-metric privacy", body: "Tokens, harnesses, models, and streaks have independent public controls enforced when profile data is built." }
    ]}
    faqs={[
      { question: "Is Agentprint a Claude Code quota tracker?", answer: "No. It tracks historical activity from local logs. It does not calculate remaining plan quota or Claude provider reset windows." },
      { question: "Does Agentprint read my prompts or source code?", answer: "Not during background sync. The usage contract only accepts numeric metadata and rejects unknown content fields." },
      { question: "Can my Claude Code activity stay private?", answer: "Yes. Profiles begin private, and you can independently control whether tokens, harnesses, models, and streaks are visible." },
      { question: "Can I also share a specific session?", answer: "Yes, through a separate explicit command. Session sharing creates a local redacted preview first and is not part of background collection." }
    ]}
    related={[
      { href: "/guides/share-claude-code-session", label: "Share a Claude Code session", detail: "Preview and publish one session deliberately." },
      { href: "/integrations/codex", label: "Codex activity tracking", detail: "Combine another supported agent on one profile." },
      { href: "/privacy", label: "Read the privacy model", detail: "See exactly what sync collects and leaves alone." }
    ]}
  />;
}
