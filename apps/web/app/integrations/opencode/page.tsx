import type { Metadata } from "next";
import { SeoContentPage } from "@/components/seo-content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "OpenCode usage tracker and activity dashboard",
  description: "Track historical OpenCode token activity from local records and add it to a privacy-controlled cross-agent Agentprint profile.",
  alternates: { canonical: absoluteUrl("/integrations/opencode") }
};

export default function OpenCodeIntegrationPage() {
  return <SeoContentPage
    eyebrow="OpenCode integration"
    title="See your OpenCode activity beyond a single terminal session."
    intro="Agentprint collects supported numeric OpenCode usage records locally and adds them to a year-long activity field, harness mix, model ranking, and privacy-controlled profile."
    qualifier="Agentprint tracks historical OpenCode activity. It does not report provider quota or billing, and OpenCode transcript sharing is not supported yet."
    agent="opencode"
    mode="tracking"
    outcomeTitle="One activity history across your coding agents."
    outcomeBody="OpenCode usage can contribute to the same profile as Claude Code, Codex, and Kimi Code without making you maintain a separate dashboard for every harness."
    steps={[
      { title: "Connect the collector", body: "Authorize one machine through the browser device-code flow.", command: "agentprint login" },
      { title: "Confirm OpenCode detection", body: "Check the source list, then collect and sync supported numeric records.", command: "agentprint sources && agentprint sync" },
      { title: "Control the profile", body: "Keep everything private or choose which activity totals, harnesses, models, and streaks visitors can see." }
    ]}
    principles={[
      { title: "Content stays out of normal sync", body: "The usage contract has no fields for prompts, responses, source code, repository names, or local paths." },
      { title: "One profile, multiple harnesses", body: "OpenCode activity sits inside the same visual history as the other supported coding agents." },
      { title: "Honest capability boundary", body: "OpenCode activity tracking is supported. Transcript sharing is not currently supported because recent OpenCode sessions use a different storage format." }
    ]}
    faqs={[
      { question: "Is OpenCode activity tracking supported?", answer: "Yes. Agentprint can discover and collect supported numeric OpenCode activity records for normal background sync." },
      { question: "Can Agentprint share an OpenCode transcript?", answer: "Not currently. Recent OpenCode versions moved message storage into opencode.db, so Agentprint still needs a dedicated session reader for that format." },
      { question: "Does background sync read OpenCode prompts?", answer: "No. The normal usage schema accepts numeric metadata and rejects transcript or project-content fields." },
      { question: "Is Agentprint an OpenCode quota tracker?", answer: "No. It records historical local activity rather than remaining quota, reset windows, or provider billing." }
    ]}
    related={[
      { href: "/integrations/kimi-code", label: "Kimi Code guide", detail: "See another local-first integration." },
      { href: "/integrations/claude-code", label: "Claude Code guide", detail: "Track and deliberately share supported sessions." },
      { href: "/docs/getting-started", label: "Getting started", detail: "Connect your machine and inspect detected sources." }
    ]}
  />;
}
