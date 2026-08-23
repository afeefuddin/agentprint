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
    intro="Agentprint turns your Claude Code activity into a year-long history, model mix, streaks, and a public profile whose visibility you control."
    qualifier="Agentprint tracks historical coding activity. It does not report remaining Claude plan quota, reset windows, or provider billing."
    agent="claude"
    mode="tracking"
    proof={[
      { value: "Local logs", label: "Read on your machine" },
      { value: "Historical", label: "Activity, not remaining quota" },
      { value: "Per metric", label: "Independent visibility controls" }
    ]}
    outcomeTitle="See the shape of your Claude Code practice."
    outcomeBody="Keep a durable record across individual terminal sessions, then decide which totals, coding tools, models, and streaks belong on your public profile."
    steps={[
      { title: "Connect your machine", body: "Sign in without sharing your Claude account password.", command: "agentprint login" },
      { title: "Add your Claude Code activity", body: "Agentprint finds Claude Code and adds dates, token counts, and model activity to your profile.", command: "agentprint sync" },
      { title: "Shape your public profile", body: "Keep the profile private, publish it, or hide individual metric groups from visitors while preserving your own view." }
    ]}
    principles={[
      { title: "Your work stays private", body: "Automatic activity tracking never includes prompts, responses, source code, repository names, or local paths." },
      { title: "No double counting", body: "Running the update again does not inflate your activity totals." },
      { title: "Choose what people see", body: "Tokens, coding tools, models, and streaks each have their own public visibility control." }
    ]}
    faqs={[
      { question: "Is Agentprint a Claude Code quota tracker?", answer: "No. It tracks historical activity from local logs. It does not calculate remaining plan quota or Claude provider reset windows." },
      { question: "Does Agentprint read my prompts or source code?", answer: "Not during automatic activity tracking. It only records activity totals and never includes your prompts, responses, or source code." },
      { question: "Can my Claude Code activity stay private?", answer: "Yes. Profiles begin private, and you can independently control whether tokens, coding tools, models, and streaks are visible." },
      { question: "Can I also share a specific session?", answer: "Yes, through a separate explicit command. Session sharing creates a local redacted preview first and is not part of background collection." }
    ]}
    related={[
      { href: "/guides/share-claude-code-session", label: "Share a Claude Code session", detail: "Preview and publish one session deliberately." },
      { href: "/integrations/codex", label: "Codex activity tracking", detail: "Combine another supported agent on one profile." },
      { href: "/privacy", label: "Read about privacy", detail: "See exactly what Agentprint collects and leaves alone." }
    ]}
  />;
}
