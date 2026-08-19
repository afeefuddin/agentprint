import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedSession, recordShareView } from "@agentprint/database";
import { formatTokens } from "@agentprint/analytics";
import { ExternalLink, EyeOff, ShieldCheck, Users } from "lucide-react";
import { viewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { ShareButton } from "@/components/share-button";
import { TranscriptView } from "@/components/transcript-view";

const harnessLabels: Record<string, string> = {
  codex: "Codex",
  "claude-code": "Claude Code",
  opencode: "OpenCode",
  "kimi-code": "Kimi Code",
  synthetic: "Synthetic"
};

const redactionCopy: Record<string, string> = {
  strict: "Strict — prompts and replies only, no tool arguments or output",
  balanced: "Balanced — full transcript with credentials and local paths removed",
  full: "Full — complete transcript with credentials removed"
};

/*
 * A session is not always one sitting. Harnesses append to the same log when a
 * conversation is resumed days later, so this has to read sensibly from a few
 * minutes to a few weeks rather than reporting five-figure minute counts.
 */
function elapsed(from: Date | string, to: Date | string) {
  const minutes = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));
  if (minutes < 60) return { value: minutes, unit: minutes === 1 ? "min" : "min" };
  const hours = minutes / 60;
  if (hours < 48) return { value: Math.round(hours), unit: Math.round(hours) === 1 ? "hour" : "hours" };
  const days = Math.round(hours / 24);
  return { value: days, unit: days === 1 ? "day" : "days" };
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const share = await getSharedSession(slug, undefined, { offset: 0, limit: 1 });
  if (!share) return { title: "Shared session" };
  const indexable = share.visibility === "public";
  return {
    title: share.title,
    description: `A ${harnessLabels[share.harness_id] ?? share.harness_id} session shared by ${share.display_name} on Agentprint.`,
    // An unlisted link is private by convention; keeping it out of indexes is
    // what makes that convention mean anything.
    robots: indexable ? undefined : { index: false, follow: false }
  };
}

export default async function SharedSessionPage({
  params
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const current = await viewer();
  const share = await getSharedSession(slug, current?.id, { offset: 0, limit: 500 });
  if (!share) notFound();
  if (!share.isOwner) await recordShareView(slug);

  const span = elapsed(share.started_at, share.ended_at);
  const hasMore = share.turns.length < share.turn_count;

  return (
    <>
      <SiteHeader current={current} variant="marketing" search />
      <main id="main" className="share-main">
        <div className="shell share-shell">
          <header className="share-head">
            <div className="share-head-copy">
              <div className="share-badges">
                <span className="share-harness">{harnessLabels[share.harness_id] ?? share.harness_id}</span>
                {share.visibility === "unlisted" ? (
                  <span className="share-flag"><EyeOff size={13} /> Unlisted link</span>
                ) : null}
                {share.visibility === "friends" ? (
                  <span className="share-flag"><Users size={13} /> Friends only</span>
                ) : null}
              </div>
              <h1>{share.title}</h1>
              <p className="share-byline">
                Shared by{" "}
                <Link href={`/${share.handle}`}>{share.display_name}</Link>
                {" · "}
                {new Date(share.published_at).toLocaleDateString("en", {
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                })}
              </p>
            </div>
            <ShareButton title={share.title} label="Copy link" />
          </header>

          <section className="share-stats" aria-label="Session summary">
            <div><span>Turns</span><strong>{share.turn_count}</strong></div>
            <div><span>Tokens</span><strong>{formatTokens(Number(share.total_tokens))}</strong></div>
            <div><span>Duration</span><strong>{span.value}<i> {span.unit}</i></strong></div>
            {share.model_ids.length > 0 && (
              <div className="share-models">
                <span>Models</span>
                <strong>{share.model_ids.join(", ")}</strong>
              </div>
            )}
          </section>

          <aside className="share-redaction">
            <ShieldCheck size={17} aria-hidden="true" />
            <div>
              <b>{redactionCopy[share.redaction_level] ?? share.redaction_level}</b>
              <p>
                Redacted on the author&rsquo;s machine before upload:{" "}
                {share.redaction_stats.secrets_removed ?? 0} credential values removed,{" "}
                {share.redaction_stats.paths_rewritten ?? 0} local paths rewritten,{" "}
                {share.redaction_stats.blocks_truncated ?? 0} blocks truncated,{" "}
                {share.redaction_stats.turns_excluded ?? 0} turns excluded.
              </p>
            </div>
            <Link href="/privacy">How sharing works <ExternalLink size={13} /></Link>
          </aside>

          <TranscriptView turns={share.turns} />

          {hasMore ? (
            <p className="share-truncated">
              Showing the first {share.turns.length} of {share.turn_count} turns.
            </p>
          ) : null}
        </div>
      </main>
    </>
  );
}
