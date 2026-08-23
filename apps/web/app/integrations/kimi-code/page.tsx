import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "Kimi Code usage tracker and activity dashboard",
  description: "Track historical Kimi Code token activity from local logs, build a privacy-controlled profile, and deliberately share redacted sessions.",
  alternates: { canonical: absoluteUrl("/integrations/kimi-code") }
};

export default function KimiCodeIntegrationPage() {
  return <ContentPage
    eyebrow="Kimi Code integration"
    title="Turn local Kimi Code activity into a durable work history."
    intro="Agentprint turns your Kimi Code activity into a year-long history, model mix, streaks, and a profile you control."
    qualifier="Agentprint tracks historical coding activity. It does not report remaining Kimi quota, reset windows, or provider billing."
    agent="kimi"
    mode="tracking"
    proof={[
      { value: "Local first", label: "Kimi activity read on-device" },
      { value: "Two paths", label: "Tracking and sharing stay separate" },
      { value: "Private", label: "Your profile starts hidden" }
    ]}
    outcomeTitle="Keep the pattern, without syncing the work itself."
    outcomeBody="Kimi Code sessions contribute to the same cross-agent activity field as your other tools, while prompts, responses, code, repository names, and local paths remain outside normal sync."
    steps={[
      { title: "Connect your machine", body: "Sign in without sharing your Kimi account credentials.", command: "agentprint login" },
      { title: "Add your Kimi Code activity", body: "Agentprint finds Kimi Code and adds its activity totals to your profile.", command: "agentprint sources && agentprint sync" },
      { title: "Choose what becomes public", body: "Keep the profile private or independently show tokens, coding tools, models, and streaks." }
    ]}
    principles={[
      { title: "Your work stays private", body: "Automatic activity tracking records your totals, not your conversations or project content." },
      { title: "Cross-agent history", body: "Kimi Code activity can live beside Claude Code, Codex, and OpenCode on one profile." },
      { title: "Deliberate session sharing", body: "A specific Kimi Code session can be previewed and redacted locally through the separate share command." }
    ]}
    faqs={[
      { question: "What Kimi Code activity does Agentprint record?", answer: "Dates, token counts, the coding tool and version, provider, and model. It does not include the contents of your work." },
      { question: "Does Agentprint share Kimi Code prompts automatically?", answer: "No. Automatic activity tracking never includes prompts, replies, code, repository names, or paths." },
      { question: "Can I share one Kimi Code session?", answer: "Yes. Kimi Code has a supported session reader. Sharing remains a separate explicit workflow with a local redacted preview before upload." },
      { question: "Can Kimi Code activity remain private?", answer: "Yes. The profile begins private, and each public metric group has its own visibility control." }
    ]}
    related={[
      { href: "/guides/share-kimi-code-session", label: "Share a Kimi Code session", detail: "Preview and publish one selected session." },
      { href: "/integrations/claude-code", label: "Claude Code guide", detail: "Track another supported local agent." },
      { href: "/privacy", label: "Read about privacy", detail: "See what Agentprint tracks automatically and what you choose to share." }
    ]}
  />;
}
