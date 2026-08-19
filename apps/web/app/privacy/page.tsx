import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import { viewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Collection boundary" };

type SchemaField = { name: string; type: string; optional?: boolean };

const schemaGroups: { label: string; note: string; fields: SchemaField[] }[] = [
  {
    label: "Identity",
    note: "Deduplicates a retry without naming you.",
    fields: [
      { name: "event_id", type: "string" },
      { name: "schema_version", type: "1" },
      { name: "source_fingerprint", type: "string" }
    ]
  },
  {
    label: "Time",
    note: "Places the work on a calendar, nothing more.",
    fields: [
      { name: "occurred_at", type: "ISO 8601, UTC" },
      { name: "local_date", type: "YYYY-MM-DD" }
    ]
  },
  {
    label: "Origin",
    note: "Which agent and model did the work.",
    fields: [
      { name: "harness_id", type: "enum" },
      { name: "harness_version", type: "string", optional: true },
      { name: "provider_id", type: "string", optional: true },
      { name: "model_id", type: "string", optional: true }
    ]
  },
  {
    label: "Volume",
    note: "Counts only. Never the tokens themselves.",
    fields: [
      { name: "input_tokens", type: "integer" },
      { name: "output_tokens", type: "integer" },
      { name: "cached_input_tokens", type: "integer", optional: true },
      { name: "reasoning_tokens", type: "integer", optional: true },
      { name: "total_tokens", type: "integer" }
    ]
  },
  {
    label: "Cost",
    note: "An estimate, plus how it was calculated.",
    fields: [
      { name: "estimated_cost_micros", type: "integer", optional: true },
      { name: "cost_basis", type: "enum", optional: true }
    ]
  }
];

export default async function PrivacyPage() {
  const current = await viewer();
  const collected = ["UTC timestamp", "Local calendar date", "Harness and optional version", "Provider and model identifiers", "Numeric token categories", "Estimated numeric cost and provenance", "Anonymous source identity"];
  const excluded = ["Prompt and response text", "Source code and file contents", "Repository names and paths", "Shell history", "API keys", "Other tool credentials", "Project or client names"];
  return (
    <>
      <SiteHeader current={current} variant="marketing" />
      <main id="main" className="privacy-page shell">
        <span className="eyebrow">Privacy specification · schema v1</span>
        <h1>The collection boundary<br /><em>is intentionally narrow.</em></h1>
        <p className="lede">The local agent reads harness-owned usage records and creates a numeric metadata record. The server contract has no place for text content, code, or paths. Sharing a session is the one exception, and it never happens automatically—see <a href="#sharing">session sharing</a> below.</p>
        <div className="boundary-columns">
          <section><h2><Check size={18} /> Collected</h2>{collected.map((item) => <div key={item}><i />{item}</div>)}</section>
          <section className="excluded"><h2><X size={18} /> Never collected</h2>{excluded.map((item) => <div key={item}><i />{item}</div>)}</section>
        </div>
        <section className="schema-spec" aria-labelledby="schema-title">
          <div className="schema-spec-heading">
            <h2 id="schema-title">Sixteen fields.<br />That is the whole record.</h2>
            <p>The <code>UsageRecord</code> contract, schema v1. A record carrying any key outside this list is rejected at the boundary.</p>
          </div>
          {schemaGroups.map((group) => (
            <div className="schema-group" key={group.label}>
              <div className="schema-group-label">
                <h3>{group.label}</h3>
                <p>{group.note}</p>
              </div>
              <dl>
                {group.fields.map((field) => (
                  <div key={field.name}>
                    <dt>{field.name}</dt>
                    <dd>{field.type}{field.optional && <em>optional</em>}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>
        <section className="privacy-prose" id="sharing">
          <h2>Session sharing is a separate pipeline.</h2>
          <p>Everything above describes background collection, which is automatic and structurally cannot carry content. Session sharing is the opposite: it publishes a full transcript—your prompts, the agent&rsquo;s replies, its tool calls and their output. It only ever runs when you ask for one specific session, one at a time, by running <code>agentprint share</code>.</p>
          <p>Before anything is uploaded, the collector rewrites the transcript on your machine. Values matching known credential shapes—provider keys, tokens, private keys, passwords inside connection strings—are replaced with a visible marker. Your home directory becomes <code>~</code> and your project path becomes <code>&lt;project&gt;</code>. Images and binary attachments are dropped entirely. Oversized tool output is truncated. At the <em>strict</em> level, tool arguments, tool output, and the agent&rsquo;s reasoning are left out altogether.</p>
          <p>You then read the result before deciding. <code>agentprint share --dry-run</code> renders the exact payload as a local page and uploads nothing at all; the interactive publish shows you the same page before asking for confirmation. The server independently re-scans every upload and refuses any transcript still carrying something that looks like a live credential.</p>
          <p>A shared session starts <em>unlisted</em>: reachable by its link, never indexed, never shown on your profile. Making it public or friends-only is a separate, deliberate choice. Deleting one removes the transcript from our database and the link stops resolving. Shared sessions are included in your data export and are deleted with your account.</p>
          <p>One thing redaction cannot do for you: a transcript is still your work in your own words. It can name colleagues and clients, and describe code you may not own. Read the preview before you publish.</p>
        </section>
        <section className="privacy-prose">
          <h2>Local first, public by choice.</h2>
          <p>Normalized events stay in a local SQLite queue until the server acknowledges them. A retry uses the same event and batch identities, so it cannot increase your totals. Your profile starts private, and visibility is enforced when profile data is queried—not merely hidden in the browser.</p>
          <p>You can pause the collector, revoke any device, export your normalized data, or delete the account and server-side data from the dashboard.</p>
        </section>
      </main>
    </>
  );
}
