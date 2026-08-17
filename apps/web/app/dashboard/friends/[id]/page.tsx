import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole, Users } from "lucide-react";
import { formatTokens } from "@agentprint/analytics";
import { getFriendComparison } from "@agentprint/database";
import { SiteHeader } from "@/components/site-header";
import { ComparisonTrace } from "@/components/comparison-trace";
import { requireViewer } from "@/lib/auth";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Friend comparison" };

const comparisonWindows = [7, 30, 90] as const;

export default async function FriendComparisonPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ window?: string }>;
}) {
  const current = await requireViewer();
  const { id } = await params;
  const requestedWindow = Number((await searchParams).window ?? "30");
  const windowDays = comparisonWindows.includes(requestedWindow as 7 | 30 | 90)
    ? requestedWindow as 7 | 30 | 90
    : 30;
  const comparison = await getFriendComparison(current.id, id, windowDays);
  if (!comparison) notFound();

  return (
    <>
      <SiteHeader current={current} />
      <main id="main" className="comparison-main">
        <div className="shell">
          <Link className="comparison-back" href="/dashboard/friends"><ArrowLeft size={15} /> Back to friends</Link>
          {comparison.status === "sharing_disabled" ? (
            <section className="comparison-disabled">
              <span><LockKeyhole size={23} /></span>
              <p className="eyebrow">Private comparison</p>
              <h1>Both traces must be shared.</h1>
              <p>{comparison.mine.sharesComparisons ? `@${comparison.other.handle} has not enabled friend comparisons yet.` : "Enable friend comparisons before aligning your trace with a friend."}</p>
              <Link className="button" href="/dashboard/friends">Review sharing controls</Link>
            </section>
          ) : (
            <ComparisonReady comparison={comparison} />
          )}
        </div>
      </main>
    </>
  );
}

function ComparisonReady({ comparison }: { comparison: Extract<Awaited<ReturnType<typeof getFriendComparison>>, { status: "ready" }> }) {
  const [mine, friend] = comparison.people;
  return (
    <>
      <header className="comparison-header">
        <div>
          <span className="eyebrow"><Users size={13} /> Mutual comparison</span>
          <h1>Two traces.<br /><em>One window.</em></h1>
          <p>Agent activity aligned by date, without scores or winners. More tokens do not imply better work.</p>
        </div>
        <nav className="comparison-windows" aria-label="Comparison window">
          {comparisonWindows.map((days) => <Link key={days} href={`?window=${days}`} aria-current={comparison.windowDays === days ? "page" : undefined}>{days} days</Link>)}
        </nav>
      </header>

      <section className="comparison-peer-rail" aria-label="Friends being compared">
        <TraceIdentity person={mine} side="left" />
        <span className="peer-rail-joint"><i /><LockKeyhole size={14} /><i /></span>
        <TraceIdentity person={friend} side="right" />
      </section>

      <ComparisonTrace mine={mine} friend={friend} windowDays={comparison.windowDays} />

      <section className="comparison-scorecard" aria-labelledby="shared-metrics-title">
        <div className="scorecard-heading">
          <TraceIdentity person={mine} side="left" compact />
          <span><h2 id="shared-metrics-title">Shared metrics</h2><small>Visible to both friends</small></span>
          <TraceIdentity person={friend} side="right" compact />
        </div>
        <PairedMetric label={`${comparison.windowDays}-day tokens`} left={formatOptionalTokens(mine.summary.totalTokens)} right={formatOptionalTokens(friend.summary.totalTokens)} />
        <PairedMetric label="Active days" left={formatOptionalNumber(mine.summary.activeDays)} right={formatOptionalNumber(friend.summary.activeDays)} />
        <PairedMetric label="Current streak" left={formatOptionalDays(mine.summary.currentStreak)} right={formatOptionalDays(friend.summary.currentStreak)} />
        <PairedMetric label="Longest streak" left={formatOptionalDays(mine.summary.longestStreak)} right={formatOptionalDays(friend.summary.longestStreak)} />
      </section>

      <section className="routing-panel" aria-labelledby="routing-title">
        <div className="routing-heading">
          <span><h2 id="routing-title">Routing fingerprints</h2><small>How each trace moved across harnesses and models.</small></span>
          <ArrowRight size={16} />
        </div>
        <ComparisonMix title="Harness routing" left={mine} right={friend} field="harnesses" visible={comparison.visibility.harnesses} />
        <ComparisonMix title="Model routing" left={mine} right={friend} field="models" visible={comparison.visibility.models} />
      </section>

      <p className="comparison-privacy"><LockKeyhole size={13} /> Only metrics enabled by both friends appear here. Hidden values stay hidden at the query boundary.</p>
    </>
  );
}

function TraceIdentity({ person, side, compact = false }: { person: { displayName: string; handle: string }; side: "left" | "right"; compact?: boolean }) {
  return (
    <div className="trace-identity" data-side={side} data-compact={compact || undefined}>
      {side === "left" && <span className="friend-avatar" aria-hidden="true">{initials(person.displayName)}</span>}
      <span><b>{person.displayName}</b><small>@{person.handle}</small></span>
      {side === "right" && <span className="friend-avatar" aria-hidden="true">{initials(person.displayName)}</span>}
    </div>
  );
}

function PairedMetric({ label, left, right }: { label: string; left: string; right: string }) {
  return <div className="paired-metric"><b>{left}</b><span>{label}</span><b>{right}</b></div>;
}

function ComparisonMix({
  title,
  left,
  right,
  field,
  visible
}: {
  title: string;
  left: { displayName: string; harnesses: Record<string, number>; models: Record<string, number> };
  right: { displayName: string; harnesses: Record<string, number>; models: Record<string, number> };
  field: "harnesses" | "models";
  visible: boolean;
}) {
  return (
    <div className="routing-row">
      <h3>{title}</h3>
      {!visible ? <p className="comparison-hidden">Hidden by one or both friends.</p> : (
        <div className="paired-mix">
          <MixList name={left.displayName} values={left[field]} side="left" />
          <MixList name={right.displayName} values={right[field]} side="right" />
        </div>
      )}
    </div>
  );
}

function MixList({ name, values, side }: { name: string; values: Record<string, number>; side: "left" | "right" }) {
  const total = Object.values(values).reduce((sum, value) => sum + value, 0);
  const rows = Object.entries(values).sort((a, b) => b[1] - a[1]).slice(0, 4);
  return (
    <div className="comparison-mix-list" data-side={side}>
      <p>{name}</p>
      {rows.length === 0 && <span className="mix-empty">No activity in this window.</span>}
      {rows.map(([label, value]) => {
        const percentage = total ? Math.round(value / total * 100) : 0;
        return <div key={label}><span><b>{label}</b><small>{percentage}%</small></span><i><em style={{ width: `${percentage}%` }} /></i></div>;
      })}
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2);
}

function formatOptionalTokens(value: number | null) {
  return value === null ? "Hidden" : formatTokens(value);
}

function formatOptionalNumber(value: number | null) {
  return value === null ? "Hidden" : value.toLocaleString();
}

function formatOptionalDays(value: number | null) {
  return value === null ? "Hidden" : `${value} ${value === 1 ? "day" : "days"}`;
}
