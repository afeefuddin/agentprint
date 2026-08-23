import type { Metadata } from "next";
import { SeoContentPage } from "@/components/seo-content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Codex usage dashboard and activity tracker",
  description: "Track historical Codex token activity from local logs, build a privacy-first public profile, and deliberately share redacted sessions.",
  alternates: { canonical: absoluteUrl("/integrations/codex") }
};

export default function CodexIntegrationPage() {
  return <SeoContentPage
    eyebrow="Codex integration"
    title="Your Codex activity, across days—not buried in terminals."
    intro="Agentprint turns your Codex activity into a clear history, model mix, streaks, and a public proof-of-work profile."
    qualifier="Agentprint is a historical activity dashboard, not an OpenAI quota, rate-limit, or billing monitor."
    agent="codex"
    mode="tracking"
    outcomeTitle="A durable trace of agent-assisted work."
    outcomeBody="Individual sessions disappear into terminal history. Agentprint keeps the numeric pattern visible while leaving the substance of your work on your machine by default."
    steps={[
      { title: "Connect your machine", body: "Sign in securely without sharing your Codex account credentials.", command: "agentprint login" },
      { title: "Add your Codex activity", body: "Agentprint finds Codex and adds its activity totals to your profile.", command: "agentprint sources && agentprint sync" },
      { title: "Read the longer arc", body: "Use your activity history, coding-tool mix, model ranking, and streaks to see patterns that no single session shows." }
    ]}
    principles={[
      { title: "Your work stays private", body: "Agentprint records dates, token counts, coding tools, and models—not prompts, replies, code, repository names, or paths." },
      { title: "One cross-agent profile", body: "Codex activity can sit beside Claude Code, OpenCode, and Kimi Code instead of living in another isolated dashboard." },
      { title: "Public only by choice", body: "Keep the whole profile private or expose only the metric groups that help tell your story." }
    ]}
    faqs={[
      { question: "Does Agentprint show my remaining Codex quota?", answer: "No. Agentprint records historical local activity. It does not report remaining quota, reset time, subscription allowance, or billing." },
      { question: "What Codex activity does Agentprint record?", answer: "Dates, token counts, the coding tool and version, provider, and model. It does not include the contents of your work." },
      { question: "Can Agentprint publish my Codex conversations automatically?", answer: "No. Transcript content uses a separate one-session-at-a-time sharing command with local preview and confirmation." },
      { question: "Can I remove a connected device?", answer: "Yes. You can remove it from settings or pause, resume, or uninstall Agentprint on that machine." }
    ]}
    related={[
      { href: "/guides/share-codex-session", label: "Share a Codex session", detail: "Create a redacted, revocable link." },
      { href: "/integrations/claude-code", label: "Claude Code integration", detail: "Add another supported local activity source." },
      { href: "/docs/getting-started", label: "Getting started", detail: "Install Agentprint and create your profile." }
    ]}
  />;
}
