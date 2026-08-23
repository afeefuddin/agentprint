import type { Metadata } from "next";
import { ContentPage } from "@/components/content-page";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  title: "How Agentprint measures coding agent activity",
  description: "Learn how Agentprint discovers supported local records, normalizes numeric metadata, prevents duplicate syncs, and builds an activity history.",
  alternates: { canonical: absoluteUrl("/methodology/activity") }
};

export default function ActivityMethodologyPage() {
  return <ContentPage
    eyebrow="Activity methodology"
    title="From local agent records to a durable daily activity history."
    intro="Agentprint discovers supported coding-agent records on your machine, converts recognized numeric metadata into a shared format, and syncs idempotent batches into your profile."
    qualifier="Agentprint measures activity volume and continuity. Token totals are not a score for code quality, output, or developer productivity."
    agent="agentprint"
    mode="tracking"
    parent={{ href: "/docs", label: "Docs" }}
    proof={[
      { value: "4 agents", label: "Supported activity sources" },
      { value: "Idempotent", label: "Repeated syncs do not inflate totals" },
      { value: "Daily", label: "Activity is normalized by date" }
    ]}
    outcomeTitle="A comparable history without pretending every tool emits the same files."
    outcomeBody="Each adapter understands its own local source. The normalized record keeps only the fields Agentprint can compare responsibly across supported agents."
    steps={[
      { title: "Discover supported local sources", body: "The collector checks known locations for Claude Code, Codex, OpenCode, and Kimi Code and reports what it finds.", command: "agentprint sources" },
      { title: "Normalize recognized numeric fields", body: "Dates, token counts, coding-tool identity, version, provider, and model are mapped into a strict shared record. Unknown or content-bearing fields do not enter the batch." },
      { title: "Sync an idempotent batch", body: "Each batch carries stable identity so retries and later scans update the history without double-counting previously accepted activity.", command: "agentprint sync" },
      { title: "Build the visible history", body: "Accepted daily records power the activity field, lifetime totals, coding-tool mix, model ranking, and streak calculations." }
    ]}
    principles={[
      { title: "Activity is descriptive", body: "A busy day can reflect exploration, debugging, or repetition. Agentprint shows the trace without converting it into a performance grade." },
      { title: "Adapters stay source-aware", body: "Claude Code, Codex, OpenCode, and Kimi Code keep separate readers because their local record formats and capabilities differ." },
      { title: "Retries remain safe", body: "Stable batch and record identities let the collector retry offline work without multiplying previously accepted totals." }
    ]}
    faqs={[
      { question: "Does a larger token total mean better work?", answer: "No. Token volume is an activity measure, not a quality or productivity score. It can be influenced by task complexity, model behavior, context size, and workflow style." },
      { question: "Can Agentprint count the same activity twice?", answer: "The sync protocol is designed to be idempotent: records and batches use stable identities so resubmitting accepted work does not inflate the activity history." },
      { question: "Why are coding-agent adapters separate?", answer: "Each supported agent stores local activity differently. Separate readers preserve those differences while emitting the same strict numeric contract." },
      { question: "Does this methodology include transcript content?", answer: "No. Automatic activity collection and explicit session sharing are separate systems with separate contracts and endpoints." }
    ]}
    related={[
      { href: "/privacy/what-agentprint-collects", label: "Collection boundary", detail: "See the accepted and excluded fields." },
      { href: "/integrations", label: "Supported integrations", detail: "Inspect each source-specific workflow." },
      { href: "/use-cases/ai-coding-activity-tracker", label: "AI coding activity tracker", detail: "See what the normalized history is useful for." }
    ]}
  />;
}
