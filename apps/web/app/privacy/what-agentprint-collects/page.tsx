import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "What Agentprint collects from coding agent logs",
  description: "See which numeric activity fields Agentprint accepts during automatic sync and which prompts, code, repositories, paths, and credentials stay outside it.",
  alternates: { canonical: absoluteUrl("/privacy/what-agentprint-collects") }
};

export default function WhatAgentprintCollectsPage() {
  return <ContentPage
    eyebrow="Collection boundary"
    title="Agentprint keeps the activity signal and leaves the work itself behind."
    intro="Automatic sync accepts a small numeric record: when activity happened, how many tokens were recorded, and which supported coding tool, version, provider, and model produced it."
    qualifier="Transcript publishing is a separate, explicit action. Turning on activity sync does not turn on conversation sharing."
    agent="agentprint"
    mode="boundary"
    parent={{ href: "/privacy", label: "Privacy" }}
    proof={[
      { value: "Numeric", label: "Dates and token totals" },
      { value: "Source-aware", label: "Tool, version, provider, and model" },
      { value: "Content-free", label: "No prompts, replies, code, repos, or paths" }
    ]}
    outcomeTitle="A narrow contract that is easier to inspect and enforce."
    outcomeBody="The collector does not try to upload a full local record and hide fields later. It constructs a recognized activity object and the API rejects unknown or content-bearing fields."
    steps={[
      { title: "Discover a supported local source", body: "Agentprint checks known local records for Claude Code, Codex, OpenCode, and Kimi Code without asking for provider account passwords.", command: "agentprint sources" },
      { title: "Construct a strict activity record", body: "The adapter emits dates, token counts, coding-tool identity and version, provider, and model. Prompt text, responses, source code, repository names, local paths, shell history, keys, and credentials are excluded." },
      { title: "Reject anything outside the contract", body: "The shared schema and ingestion API refuse unknown fields rather than storing arbitrary source records for future use." },
      { title: "Apply profile visibility at the data boundary", body: "Public-profile queries include only the metric groups you enabled, instead of downloading private fields and hiding them with browser styling." }
    ]}
    principles={[
      { title: "Collection is intentionally boring", body: "The normal sync record is useful for activity history precisely because it excludes the interesting—and sensitive—substance of the session." },
      { title: "Visibility is enforced before rendering", body: "Token totals, coding tools, models, and streaks each have a server-enforced public visibility control." },
      { title: "Leaving stays possible", body: "You can pause collection, revoke a device, export your account data, remove shared sessions, or delete the account." }
    ]}
    faqs={[
      { question: "Does Agentprint upload my prompts during automatic sync?", answer: "No. Prompts and assistant replies are not part of the automatic activity contract." },
      { question: "Does Agentprint collect repository names or file paths?", answer: "No. Repository names, project paths, home directories, and source code are outside automatic activity collection." },
      { question: "What fields can appear in my public profile?", answer: "Your display identity and the activity groups you enable: token totals, coding-agent mix, model mix, and streaks. Each activity group has its own visibility control." },
      { question: "How is session sharing different?", answer: "It uses a separate command, contract, endpoint, database path, local preview, confirmation step, visibility choice, and revocation workflow for one selected session." }
    ]}
    related={[
      { href: "/methodology/activity", label: "Activity methodology", detail: "See how accepted numeric records become a daily history." },
      { href: "/security/session-redaction", label: "Session redaction", detail: "Understand the separate content-sharing workflow." },
      { href: "/integrations/claude-code", label: "Supported coding agents", detail: "Inspect source-specific capabilities and limitations." }
    ]}
  />;
}
