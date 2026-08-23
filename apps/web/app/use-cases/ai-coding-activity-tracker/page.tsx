import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "AI coding activity tracker across Claude Code and Codex",
  description: "Track historical activity across Claude Code, Codex, OpenCode, and Kimi Code in one privacy-controlled developer profile.",
  alternates: { canonical: absoluteUrl("/use-cases/ai-coding-activity-tracker") }
};

export default function AiCodingActivityTrackerPage() {
  return <ContentPage
    eyebrow="AI coding activity tracker"
    title="Stop rebuilding your coding history inside every new agent."
    intro="Agentprint combines historical activity from Claude Code, Codex, OpenCode, and Kimi Code into one durable timeline, model mix, coding-tool mix, and set of streaks."
    qualifier="This is historical activity tracking—not live quota, rate-limit, billing, code-quality, or productivity scoring."
    agent="agentprint"
    mode="tracking"
    parent={{ href: "/integrations", label: "Use cases" }}
    proof={[
      { value: "4 agents", label: "One normalized activity history" },
      { value: "12 months", label: "A year-long activity field" },
      { value: "Per metric", label: "Independent visibility controls" }
    ]}
    outcomeTitle="See continuity and tool choice across the whole practice."
    outcomeBody="A single-agent dashboard answers what happened in one product. Agentprint answers how your overall agent-assisted practice changes as tools and models change."
    steps={[
      { title: "Connect the machine where you build", body: "Install the native collector and sign in through your browser. Agentprint finds supported local coding-agent records.", command: "agentprint login" },
      { title: "Confirm the sources", body: "See which supported agents were found before syncing anything. Missing or unsupported tools remain visible as limitations, not silently guessed.", command: "agentprint sources" },
      { title: "Create one normalized history", body: "Dates, token counts, tools, and models flow into the same daily activity format without uploading prompts or project content.", command: "agentprint sync" },
      { title: "Decide what the profile says", body: "Keep the profile private or independently publish token totals, coding-tool mix, model mix, and streaks." }
    ]}
    principles={[
      { title: "Cross-agent, not provider-locked", body: "Your history remains useful when you add a new supported coding agent or change which model you reach for." },
      { title: "Durable, not real-time pressure", body: "Agentprint shows the longer arc of practice rather than turning a quota reset or live counter into a performance target." },
      { title: "Evidence without a score", body: "The profile can show consistent activity and tool fluency without claiming that more tokens automatically mean better engineering." }
    ]}
    faqs={[
      { question: "Which AI coding agents can Agentprint track?", answer: "Automatic activity tracking currently supports Claude Code, Codex, OpenCode, and Kimi Code." },
      { question: "Does it track remaining Claude or Codex quota?", answer: "No. Agentprint tracks historical activity from local records. It does not report live provider quota, reset windows, or billing." },
      { question: "Can I use more than one computer?", answer: "Yes. Connected devices can contribute to the same profile, and the idempotent sync protocol prevents accepted records from multiplying during retries." },
      { question: "Can I keep the tracker private?", answer: "Yes. Profiles begin private and every activity group has its own public visibility setting." }
    ]}
    related={[
      { href: "/integrations", label: "Browse integrations", detail: "See source-specific support and limitations." },
      { href: "/methodology/activity", label: "How activity is measured", detail: "Inspect normalization and deduplication." },
      { href: "/use-cases/developer-ai-profile", label: "Developer AI profile", detail: "Turn the private history into public proof of work." }
    ]}
  />;
}
