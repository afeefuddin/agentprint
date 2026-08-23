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
    intro="Agentprint turns your OpenCode activity into a year-long history, coding-tool mix, model ranking, and privacy-controlled profile."
    qualifier="Agentprint tracks historical OpenCode activity. It does not report provider quota or billing, and OpenCode transcript sharing is not supported yet."
    agent="opencode"
    mode="tracking"
    proof={[
      { value: "Activity", label: "Historical totals are supported" },
      { value: "Private", label: "Conversation content is excluded" },
      { value: "Tracking only", label: "Session sharing is not supported yet" }
    ]}
    outcomeTitle="One activity history across your coding agents."
    outcomeBody="OpenCode activity can contribute to the same profile as Claude Code, Codex, and Kimi Code without making you maintain a separate dashboard for every tool."
    steps={[
      { title: "Connect your machine", body: "Sign in to Agentprint from your browser.", command: "agentprint login" },
      { title: "Add your OpenCode activity", body: "Confirm that Agentprint found OpenCode, then add its activity totals to your profile.", command: "agentprint sources && agentprint sync" },
      { title: "Control the profile", body: "Keep everything private or choose which activity totals, coding tools, models, and streaks visitors can see." }
    ]}
    principles={[
      { title: "Your work stays private", body: "Automatic activity tracking never includes prompts, responses, source code, repository names, or local paths." },
      { title: "One profile, multiple tools", body: "OpenCode activity sits inside the same visual history as the other supported coding agents." },
      { title: "Activity tracking only", body: "You can track OpenCode activity, but sharing OpenCode sessions is not supported yet." }
    ]}
    faqs={[
      { question: "Is OpenCode activity tracking supported?", answer: "Yes. Agentprint can find OpenCode and keep its activity totals current automatically." },
      { question: "Can Agentprint share an OpenCode session?", answer: "Not currently. OpenCode activity tracking is supported, but session sharing is not." },
      { question: "Does Agentprint read OpenCode prompts automatically?", answer: "No. Automatic activity tracking never includes conversations or project content." },
      { question: "Is Agentprint an OpenCode quota tracker?", answer: "No. It records historical local activity rather than remaining quota, reset windows, or provider billing." }
    ]}
    related={[
      { href: "/integrations/kimi-code", label: "Kimi Code guide", detail: "See another local-first integration." },
      { href: "/integrations/claude-code", label: "Claude Code guide", detail: "Track and deliberately share supported sessions." },
      { href: "/docs/getting-started", label: "Getting started", detail: "Connect your machine and confirm that Agentprint found your coding tools." }
    ]}
  />;
}
