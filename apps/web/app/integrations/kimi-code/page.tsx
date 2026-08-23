import type { Metadata } from "next";
import { SeoContentPage } from "@/components/seo-content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Kimi Code usage tracker and activity dashboard",
  description: "Track historical Kimi Code token activity from local logs, build a privacy-controlled profile, and deliberately share redacted sessions.",
  alternates: { canonical: absoluteUrl("/integrations/kimi-code") }
};

export default function KimiCodeIntegrationPage() {
  return <SeoContentPage
    eyebrow="Kimi Code integration"
    title="Turn local Kimi Code activity into a durable work history."
    intro="Agentprint reads supported Kimi Code records on your machine and turns numeric token activity into a year-long field, model mix, streaks, and a profile you control."
    qualifier="Agentprint tracks historical coding activity. It does not report remaining Kimi quota, reset windows, or provider billing."
    agent="kimi"
    mode="tracking"
    outcomeTitle="Keep the pattern, without syncing the work itself."
    outcomeBody="Kimi Code sessions contribute to the same cross-agent activity field as your other tools, while prompts, responses, code, repository names, and local paths remain outside normal sync."
    steps={[
      { title: "Connect your machine", body: "The browser device-code flow authorizes the local collector without asking for your Kimi account credentials.", command: "agentprint login" },
      { title: "Detect and sync Kimi Code", body: "Agentprint discovers the local source and sends schema-validated numeric usage records.", command: "agentprint sources && agentprint sync" },
      { title: "Choose what becomes public", body: "Keep the profile private or independently expose tokens, harnesses, models, and streaks." }
    ]}
    principles={[
      { title: "Metadata-only background sync", body: "Normal collection accepts usage numbers and source identity, not transcript or project content." },
      { title: "Cross-agent history", body: "Kimi Code activity can live beside Claude Code, Codex, and OpenCode on one profile." },
      { title: "Deliberate session sharing", body: "A specific Kimi Code session can be previewed and redacted locally through the separate share command." }
    ]}
    faqs={[
      { question: "What Kimi Code data does Agentprint collect?", answer: "Normal sync sends numeric usage metadata such as date, token counts, harness, version, provider, and model information." },
      { question: "Does Agentprint upload Kimi Code prompts automatically?", answer: "No. Background sync cannot accept prompts, replies, code, repository names, or paths." },
      { question: "Can I share one Kimi Code session?", answer: "Yes. Kimi Code has a supported session reader. Sharing remains a separate explicit workflow with a local redacted preview before upload." },
      { question: "Can Kimi Code activity remain private?", answer: "Yes. The profile begins private, and each public metric group has its own visibility control." }
    ]}
    related={[
      { href: "/integrations/claude-code", label: "Claude Code guide", detail: "Track another supported local agent." },
      { href: "/integrations/codex", label: "Codex guide", detail: "Add Codex activity to the same profile." },
      { href: "/privacy", label: "Read the privacy model", detail: "See the background-sync and sharing boundaries." }
    ]}
  />;
}
