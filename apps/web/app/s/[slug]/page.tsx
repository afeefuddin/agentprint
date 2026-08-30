import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSharedSession, recordShareView } from "@agentprint/database";
import { formatTokens } from "@agentprint/analytics";
import {
  ArrowLeft,
  ChevronDown,
  Clock3,
  Coins,
  ExternalLink,
  EyeOff,
  Globe2,
  MessageSquareText,
  ShieldCheck,
  Users
} from "lucide-react";
import { viewer } from "@/lib/auth";
import { harnessBrand, harnessLabels } from "@/lib/brands";
import { SiteHeader } from "@/components/site-header";
import { ShareButton } from "@/components/share-button";
import {
  TranscriptView,
  finalAssistantTurnIndex,
  isTranscriptTurnVisible
} from "@/components/transcript-view";
import { ProximitySidebar, type ProximitySection } from "@/components/ui/proximity-sidebar";
import { appMainClass } from "@/lib/ui";
import { absoluteUrl } from "@/lib/site";

const redactionCopy: Record<string, string> = {
  strict: "Prompts and replies only; tool arguments and output are hidden.",
  balanced: "Full transcript with credentials and local paths removed.",
  full: "Complete transcript with credential values removed."
};

function VisibilityIcon({ visibility }: { visibility: string }) {
  if (visibility === "public") return <Globe2 size={13} aria-hidden="true" />;
  if (visibility === "friends") return <Users size={13} aria-hidden="true" />;
  return <EyeOff size={13} aria-hidden="true" />;
}

const visibilityLabels: Record<string, string> = {
  unlisted: "Unlisted",
  friends: "Friends",
  public: "Public"
};

function elapsed(from: Date | string, to: Date | string) {
  const minutes = Math.max(1, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (hours < 48) return `${Math.round(hours)} ${Math.round(hours) === 1 ? "hour" : "hours"}`;
  const days = Math.round(hours / 24);
  return `${days} ${days === 1 ? "day" : "days"}`;
}

function countLabel(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

export async function generateMetadata({
  params
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const share = await getSharedSession(slug, undefined, { offset: 0, limit: 1 });
  if (!share) return { title: "Shared session", robots: { index: false, follow: false } };
  const indexable = share.visibility === "public";
  const harness = harnessLabels[share.harness_id] ?? share.harness_id;
  const title = `${share.title} – ${harness} coding session`;
  const description = `A ${harness} session deliberately shared by ${share.display_name} through Agentprint.`;
  return {
    title: { absolute: title },
    description,
    alternates: indexable ? { canonical: absoluteUrl(`/s/${share.slug}`) } : undefined,
    robots: indexable ? undefined : { index: false, follow: false },
    openGraph: indexable ? { type: "article", url: absoluteUrl(`/s/${share.slug}`), title, description } : undefined,
    twitter: indexable ? { card: "summary_large_image", title, description } : undefined
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

  const brand = harnessBrand(share.harness_id);
  const hasMore = share.turns.length < share.turn_count;
  const visibleTurns = share.turns.filter(isTranscriptTurnVisible);
  const finalTurnIndex = finalAssistantTurnIndex(visibleTurns);
  const transcriptSections = visibleTurns.map((turn, index) => ({
    id: `turn-${turn.index}`,
    label: turn.index === finalTurnIndex
      ? "final answer"
      : `turn ${index + 1}, ${turn.role === "user" ? "prompt" : turn.role === "system" ? "system" : "agent"}`,
    kind: turn.index === finalTurnIndex
      ? "title"
      : turn.role === "user" ? "subtitle" : turn.role === "system" ? "section" : "body"
  })) satisfies ProximitySection[];
  return (
    <>
      <SiteHeader current={current} variant="marketing" search />
      <main id="main" className={appMainClass}>
        <div className="shell max-w-[1040px]">
          <Link
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-muted hover:text-ink-strong"
            href={share.isOwner ? "/sessions" : `/${share.handle}`}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            {share.isOwner ? "Back to your sessions" : `Back to @${share.handle}`}
          </Link>

          <header className="pb-8">
            <div className="flex flex-wrap items-center gap-2.5 text-xs text-faint">
              <span className="inline-flex items-center gap-[7px] font-semibold text-ink-strong">
                <i className="size-2 rounded-full" style={{ background: brand.color }} aria-hidden="true" />
                {harnessLabels[share.harness_id] ?? brand.label}
              </span>
              <span className="text-line-strong" aria-hidden="true">/</span>
              <span className="inline-flex items-center gap-[5px]">
                <VisibilityIcon visibility={share.visibility} /> {visibilityLabels[share.visibility] ?? share.visibility}
              </span>
              <span className="text-line-strong" aria-hidden="true">·</span>
              <span>Published {new Date(share.published_at).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric" })}</span>
            </div>

            <div className="mt-5 flex items-start justify-between gap-8 max-tablet:flex-col max-tablet:gap-5">
              <div className="max-w-[780px]">
                <h1 className="m-0 text-4xl font-semibold leading-[1.08] tracking-[-.04em] text-ink-strong max-tablet:text-3xl">
                  {share.title}
                </h1>
                {share.summary ? <p className="mt-4 max-w-[720px] text-base leading-[1.6] text-muted">{share.summary}</p> : null}
                <p className="mt-4 text-xs text-faint">
                  Shared by{" "}
                  <Link className="font-semibold text-ink-strong hover:text-accent" href={`/${share.handle}`}>
                    {share.display_name} <span className="text-faint">@{share.handle}</span>
                  </Link>
                </p>
              </div>
              <ShareButton title={share.title} label="Copy session link" className="shrink-0" />
            </div>
          </header>

          <section className="grid grid-cols-4 overflow-hidden rounded-sm border border-line max-tablet:grid-cols-2" aria-label="Session summary">
            <div className="border-r border-line px-5 py-4 max-tablet:border-b">
              <span className="flex items-center gap-1.5 text-xs text-faint"><MessageSquareText size={13} /> Turns</span>
              <strong className="mt-1.5 block text-md font-semibold text-ink-strong [font-variant-numeric:tabular-nums]">{share.turn_count}</strong>
            </div>
            <div className="border-r border-line px-5 py-4 max-tablet:border-b max-tablet:border-r-0">
              <span className="flex items-center gap-1.5 text-xs text-faint"><Coins size={13} /> Tokens</span>
              <strong className="mt-1.5 block text-md font-semibold text-ink-strong [font-variant-numeric:tabular-nums]">{formatTokens(Number(share.total_tokens))}</strong>
            </div>
            <div className="border-r border-line px-5 py-4">
              <span className="flex items-center gap-1.5 text-xs text-faint"><Clock3 size={13} /> Duration</span>
              <strong className="mt-1.5 block text-md font-semibold text-ink-strong [font-variant-numeric:tabular-nums]">{elapsed(share.started_at, share.ended_at)}</strong>
            </div>
            <div className="px-5 py-4">
              <span className="text-xs text-faint">Model</span>
              <strong className="mt-1.5 block truncate text-sm font-semibold text-ink-strong">
                {share.model_ids.join(", ") || "Not reported"}
              </strong>
            </div>
          </section>

          <details className="group/privacy border-b border-line">
            <summary className="flex min-h-[54px] cursor-pointer list-none items-center gap-2.5 py-3 text-xs [&::-webkit-details-marker]:hidden">
              <ShieldCheck size={15} className="text-accent" aria-hidden="true" />
              <b className="font-semibold text-ink-strong">Redacted before upload</b>
              <span className="truncate text-muted">
                {countLabel(share.redaction_stats.secrets_removed ?? 0, "credential value")} removed. {redactionCopy[share.redaction_level] ?? share.redaction_level}
              </span>
              <ChevronDown size={13} className="ml-auto text-faint transition-transform group-open/privacy:rotate-180" aria-hidden="true" />
            </summary>
            <div className="grid grid-cols-[1fr_auto] gap-6 pb-4 pl-[25px] max-tablet:grid-cols-1 max-tablet:gap-3">
              <p className="text-xs leading-[1.55] text-muted">
                {countLabel(share.redaction_stats.secrets_removed ?? 0, "credential")} removed, {countLabel(share.redaction_stats.paths_rewritten ?? 0, "local path")} rewritten, {countLabel(share.redaction_stats.blocks_truncated ?? 0, "block")} truncated, and {countLabel(share.redaction_stats.turns_excluded ?? 0, "turn")} excluded.
              </p>
              <Link className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-accent" href="/privacy">
                How sharing works <ExternalLink size={13} />
              </Link>
            </div>
          </details>

          <TranscriptView turns={share.turns} />
          <aside className="fixed left-[max(16px,calc(50vw_-_632px))] top-[calc(var(--header-h)+32px)] z-10 hidden h-[calc(100vh-var(--header-h)-64px)] min-[1280px]:block">
            <ProximitySidebar sections={transcriptSections} side="left" />
          </aside>

          {hasMore ? (
            <p className="mt-5 text-center text-xs text-faint">Showing the first {share.turns.length} of {share.turn_count} turns.</p>
          ) : null}
        </div>
      </main>
    </>
  );
}
