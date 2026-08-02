import type { Metadata } from "next";
import { Check, X } from "lucide-react";
import { viewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = { title: "Collection boundary" };

export default async function PrivacyPage() {
  const current = await viewer();
  const collected = ["UTC timestamp", "Local calendar date", "Harness and optional version", "Provider and model identifiers", "Numeric token categories", "Estimated numeric cost and provenance", "Anonymous source identity"];
  const excluded = ["Prompt and response text", "Source code and file contents", "Repository names and paths", "Shell history", "API keys", "Other tool credentials", "Project or client names"];
  return (
    <>
      <SiteHeader current={current} />
      <main id="main" className="privacy-page shell">
        <span className="eyebrow">Privacy specification · schema v1</span>
        <h1>The collection boundary<br /><em>is intentionally narrow.</em></h1>
        <p className="lede">The local agent reads harness-owned usage records and creates a numeric metadata record. The server contract has no place for text content, code, or paths.</p>
        <div className="boundary-columns">
          <section><h2><Check size={18} /> Collected</h2>{collected.map((item) => <div key={item}><i />{item}</div>)}</section>
          <section className="excluded"><h2><X size={18} /> Never collected</h2>{excluded.map((item) => <div key={item}><i />{item}</div>)}</section>
        </div>
        <pre className="schema-card">{`UsageRecord {
  event_id, schema_version,
  occurred_at, local_date,
  harness_id, harness_version?,
  provider_id?, model_id?,
  input_tokens, output_tokens,
  cached_input_tokens?, reasoning_tokens?,
  total_tokens, estimated_cost_micros?,
  cost_basis?, source_fingerprint
}`}</pre>
        <section className="privacy-prose">
          <h2>Local first, public by choice.</h2>
          <p>Normalized events stay in a local SQLite queue until the server acknowledges them. A retry uses the same event and batch identities, so it cannot increase your totals. Your profile starts private, and visibility is enforced when profile data is queried—not merely hidden in the browser.</p>
          <p>You can pause the collector, revoke any device, export your normalized data, or delete the account and server-side data from the dashboard.</p>
        </section>
      </main>
    </>
  );
}
