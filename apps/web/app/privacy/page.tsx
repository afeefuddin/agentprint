import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import { viewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { eyebrowClass } from "@/lib/ui";

const BOUNDARY_TITLE = "m-0 flex items-center gap-[9px] py-5 text-base font-[weight:550]";
const BOUNDARY_ROW = "flex items-center gap-2.5 border-t border-line py-[11px] text-xs text-muted";
const PROSE_SECTION = "ml-auto max-w-[720px]";
const PROSE_TITLE = "text-[31px] font-[weight:520] tracking-[-.035em]";
const PROSE_COPY = "my-4 leading-[1.8] text-muted";

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
      <main id="main" className="shell pb-[var(--page-bottom)] pt-[var(--page-top)]">
        <span className={eyebrowClass}>Privacy specification · schema v1</span>
        <h1 className="my-[22px] max-w-[900px] text-[clamp(46px,6vw,75px)] font-normal leading-[.98] tracking-[-.055em] text-ink-strong">
          The collection boundary<br /><em className="tracking-[-.06em] text-ink-strong">is intentionally narrow.</em>
        </h1>
        <p className="max-w-[680px] text-base leading-[1.7] text-muted">The local agent reads harness-owned usage records and creates a numeric metadata record. The server contract has no place for text content, code, or paths. Sharing a session is the one exception, and it never happens automatically—see <a href="#sharing">session sharing</a> below.</p>
        <div className="mt-[65px] grid grid-cols-2 gap-6 max-tablet:grid-cols-[1fr]">
          <section className="border-t-2 border-green">
            <h2 className={BOUNDARY_TITLE}><Check size={18} /> Collected</h2>
            {collected.map((item) => (
              <div key={item} className={BOUNDARY_ROW}><i className="size-[5px] rounded-full bg-green" />{item}</div>
            ))}
          </section>
          <section className="border-t-2 border-red">
            <h2 className={BOUNDARY_TITLE}><X size={18} /> Never collected</h2>
            {excluded.map((item) => (
              <div key={item} className={BOUNDARY_ROW}><i className="size-[5px] rounded-full bg-red" />{item}</div>
            ))}
          </section>
        </div>
        <section className="my-20 mb-[95px] max-tablet:mb-[62px] max-tablet:mt-[52px]" aria-labelledby="schema-title">
          <div className="grid grid-cols-2 items-end gap-10 pb-[34px] max-tablet:grid-cols-[1fr] max-tablet:gap-[18px] max-tablet:pb-[26px]">
            <h2
              id="schema-title"
              className="m-0 text-[34px] font-[weight:520] leading-[1.15] tracking-[-.035em] text-ink-strong max-tablet:text-[27px]"
            >
              Sixteen fields.<br />That is the whole record.
            </h2>
            <p className="m-0 max-w-[430px] text-xs leading-[1.75] text-muted">
              The <code className="font-[weight:550] text-ink-strong">UsageRecord</code> contract, schema v1. A record carrying any key outside this list is rejected at the boundary.
            </p>
          </div>
          {schemaGroups.map((group) => (
            <div
              className="grid grid-cols-[210px_1fr] gap-11 border-t border-line pb-[34px] pt-[30px] last:border-b last:border-line max-tablet:grid-cols-[1fr] max-tablet:gap-[18px] max-tablet:pb-[26px] max-tablet:pt-6"
              key={group.label}
            >
              <div>
                <h3 className="m-0 text-base font-[weight:550] tracking-[-.01em] text-ink-strong">{group.label}</h3>
                <p className="mt-[7px] text-xs leading-[1.6] text-faint">{group.note}</p>
              </div>
              <dl className="m-0 grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-x-[46px] gap-y-0 max-tablet:grid-cols-[1fr]">
                {group.fields.map((field) => (
                  <div key={field.name} className="flex items-baseline gap-3 py-[9px]">
                    <dt className="flex flex-1 items-baseline gap-3 text-base font-[weight:520] text-ink-strong after:mb-[5px] after:flex-1 after:border-b after:border-dotted after:border-line-strong after:content-['']">
                      {field.name}
                    </dt>
                    <dd className="m-0 whitespace-nowrap text-xs font-medium text-faint">
                      {field.type}
                      {field.optional && (
                        <em className="not-italic text-amber before:mx-[5px] before:text-line-strong before:content-['·']">optional</em>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </section>
        <section className={PROSE_SECTION} id="sharing">
          <h2 className={PROSE_TITLE}>Session sharing is a separate pipeline.</h2>
          <p className={PROSE_COPY}>Everything above describes background collection, which is automatic and structurally cannot carry content. Session sharing is the opposite: it publishes a full transcript—your prompts, the agent&rsquo;s replies, its tool calls and their output. It only ever runs when you ask for one specific session, one at a time, by running <code className="font-[weight:550] text-ink-strong">agentprint share</code>.</p>
          <p className={PROSE_COPY}>Before anything is uploaded, the collector rewrites the transcript on your machine. Values matching known credential shapes—provider keys, tokens, private keys, passwords inside connection strings—are replaced with a visible marker. Your home directory becomes <code className="font-[weight:550] text-ink-strong">~</code> and your project path becomes <code className="font-[weight:550] text-ink-strong">&lt;project&gt;</code>. Images and binary attachments are dropped entirely. Oversized tool output is truncated. At the <em>strict</em> level, tool arguments, tool output, and the agent&rsquo;s reasoning are left out altogether.</p>
          <p className={PROSE_COPY}>You then read the result before deciding. <code className="font-[weight:550] text-ink-strong">agentprint share --dry-run</code> renders the exact payload as a local page and uploads nothing at all; the interactive publish shows you the same page before asking for confirmation. The server independently re-scans every upload and refuses any transcript still carrying something that looks like a live credential.</p>
          <p className={PROSE_COPY}>A shared session starts <em>unlisted</em>: reachable by its link, never indexed, never shown on your profile. Making it public or friends-only is a separate, deliberate choice. Deleting one removes the transcript from our database and the link stops resolving. Shared sessions are included in your data export and are deleted with your account.</p>
          <p className={PROSE_COPY}>One thing redaction cannot do for you: a transcript is still your work in your own words. It can name colleagues and clients, and describe code you may not own. Read the preview before you publish.</p>
        </section>
        <section className={PROSE_SECTION}>
          <h2 className={PROSE_TITLE}>Local first, public by choice.</h2>
          <p className={PROSE_COPY}>Normalized events stay in a local SQLite queue until the server acknowledges them. A retry uses the same event and batch identities, so it cannot increase your totals. Your profile starts private, and visibility is enforced when profile data is queried—not merely hidden in the browser.</p>
          <p className={PROSE_COPY}>You can pause the collector, revoke any device, export your normalized data, or delete the account and server-side data from the dashboard.</p>
        </section>
      </main>
    </>
  );
}
