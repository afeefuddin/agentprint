import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole, Users } from "lucide-react";
import { formatTokens } from "@agentprint/analytics";
import { getFriendComparison } from "@agentprint/database";
import { ComparisonTrace } from "@/components/comparison-trace";
import { requireViewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { notFound } from "next/navigation";
import { appMainClass, avatarChipClass, cx, eyebrowClass } from "@/lib/ui";

export const metadata: Metadata = { title: "Friend comparison" };

const comparisonWindows = [7, 30, 90] as const;

const PANEL = "mt-9 overflow-hidden rounded-md border border-line bg-panel";
const PANEL_TITLE = "m-0 block text-sm font-semibold text-ink-strong";
const PANEL_SUB = "mt-[3px] block text-xs text-faint";
const HEADING_ROW = "flex items-center justify-between gap-5 pb-5";
const METRIC_GRID =
  "grid grid-cols-[1fr_minmax(150px,.55fr)_1fr] items-center max-tablet:grid-cols-[1fr_92px_1fr]";
const METRIC_VALUE =
  "px-[18px] text-2xl font-semibold text-ink-strong [font-variant-numeric:tabular-nums] max-tablet:px-2 max-tablet:text-base";
const MUTED_NOTE = "text-xs text-faint";

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
      <main id="main" className={appMainClass}>
        <div className="shell">
          <Link className="inline-flex items-center gap-[7px] text-xs text-muted hover:text-ink-strong" href="/friends"><ArrowLeft size={15} /> Back to friends</Link>
          <ComparisonReady comparison={comparison} />
        </div>
      </main>
    </>
  );
}

function ComparisonReady({ comparison }: { comparison: NonNullable<Awaited<ReturnType<typeof getFriendComparison>>> }) {
  const [mine, friend] = comparison.people;
  return (
    <>
      <header className="mt-9 flex items-end justify-between gap-10 max-desktop:flex-col max-desktop:items-start">
        <div>
          <span className={cx(eyebrowClass, "flex items-center gap-1.5")}><Users size={13} /> Mutual comparison</span>
          <h1 className="mb-2.5 mt-3 text-6xl font-medium leading-[.96] text-ink-strong max-tablet:text-4xl">
            Two traces.<br /><em className="font-display text-blue">One window.</em>
          </h1>
          <p className="m-0 max-w-[610px] text-sm leading-[1.65] text-muted">
            Agent activity aligned by date, without scores or winners. More tokens do not imply better work.
          </p>
        </div>
        <nav
          className="flex overflow-hidden rounded-sm border border-line-strong bg-panel max-tablet:w-full"
          aria-label="Comparison window"
        >
          {comparisonWindows.map((days) => (
            <Link
              key={days}
              className="min-w-[68px] border-r border-line px-[11px] py-2.5 text-center text-xs text-muted transition-[background-color,color] duration-[130ms] last:border-r-0 hover:bg-canvas-deep hover:text-ink-strong focus-visible:relative focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue aria-[current=page]:bg-ink-strong aria-[current=page]:text-canvas max-tablet:flex-1"
              href={`?window=${days}`}
              aria-current={comparison.windowDays === days ? "page" : undefined}
            >
              {days} days
            </Link>
          ))}
        </nav>
      </header>

      <section
        className="mt-9 grid grid-cols-[1fr_minmax(180px,.4fr)_1fr] items-center border-y border-line-strong py-3.5 max-tablet:grid-cols-[1fr_48px_1fr]"
        aria-label="Friends being compared"
      >
        <TraceIdentity person={mine} side="left" />
        <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-[9px] text-blue max-tablet:grid-cols-[1fr] max-tablet:justify-items-center">
          <i className="h-px bg-steel-2 max-tablet:hidden" /><LockKeyhole size={14} /><i className="h-px bg-steel-2 max-tablet:hidden" />
        </span>
        <TraceIdentity person={friend} side="right" />
      </section>

      <ComparisonTrace mine={mine} friend={friend} windowDays={comparison.windowDays} />

      <section className={PANEL} aria-labelledby="shared-metrics-title">
        <div className={cx(METRIC_GRID, "min-h-[68px] border-b border-line-strong px-4 max-tablet:px-2.5")}>
          <TraceIdentity person={mine} side="left" compact />
          <span className="text-center">
            <h2 id="shared-metrics-title" className="m-0 block text-xs font-semibold text-ink-strong">Shared metrics</h2>
            <small className="mt-0.5 block text-2xs text-faint">Visible to both friends</small>
          </span>
          <TraceIdentity person={friend} side="right" compact />
        </div>
        <PairedMetric label={`${comparison.windowDays}-day tokens`} left={formatOptionalTokens(mine.summary.totalTokens)} right={formatOptionalTokens(friend.summary.totalTokens)} />
        <PairedMetric label="Active days" left={formatOptionalNumber(mine.summary.activeDays)} right={formatOptionalNumber(friend.summary.activeDays)} />
        <PairedMetric label="Current streak" left={formatOptionalDays(mine.summary.currentStreak)} right={formatOptionalDays(friend.summary.currentStreak)} />
        <PairedMetric label="Longest streak" left={formatOptionalDays(mine.summary.longestStreak)} right={formatOptionalDays(friend.summary.longestStreak)} />
      </section>

      <section className={cx(PANEL, "p-7 max-tablet:p-[22px]")} aria-labelledby="routing-title">
        <div className={cx(HEADING_ROW, "border-b border-line")}>
          <span>
            <h2 id="routing-title" className={PANEL_TITLE}>Routing fingerprints</h2>
            <small className={PANEL_SUB}>How each activity history moved across coding tools and models.</small>
          </span>
          <ArrowRight size={16} className="text-faint" />
        </div>
        <ComparisonMix title="Coding-tool mix" left={mine} right={friend} field="harnesses" visible={comparison.visibility.harnesses} />
        <ComparisonMix title="Model routing" left={mine} right={friend} field="models" visible={comparison.visibility.models} />
      </section>

      <p className="mt-5 flex items-center justify-center gap-[7px] text-xs text-faint max-tablet:items-start max-tablet:justify-start">
        <LockKeyhole size={13} /> Only metrics enabled by both friends appear here. Hidden values stay hidden at the query boundary.
      </p>
    </>
  );
}

function TraceIdentity({ person, side, compact = false }: { person: { displayName: string; handle: string }; side: "left" | "right"; compact?: boolean }) {
  return (
    <div className={cx("flex min-w-0 items-center gap-[11px]", side === "right" && "justify-end text-right")}>
      {side === "left" && <Initials name={person.displayName} compact={compact} />}
      <span className="min-w-0">
        <b className="block truncate text-xs text-ink-strong">{person.displayName}</b>
        <small className={cx("mt-0.5 block truncate text-xs text-faint", compact && "max-tablet:hidden")}>@{person.handle}</small>
      </span>
      {side === "right" && <Initials name={person.displayName} compact={compact} />}
    </div>
  );
}

function Initials({ name, compact }: { name: string; compact: boolean }) {
  return (
    <span
      className={avatarChipClass(compact)}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

function PairedMetric({ label, left, right }: { label: string; left: string; right: string }) {
  return (
    <div className={cx(METRIC_GRID, "min-h-[69px] border-b border-line text-center last:border-b-0")}>
      <b className={cx(METRIC_VALUE, "text-right")}>{left}</b>
      <span className="grid select-none place-items-center self-stretch border-x border-line bg-canvas-deep text-xs text-muted">
        {label}
      </span>
      <b className={cx(METRIC_VALUE, "text-left")}>{right}</b>
    </div>
  );
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
    <div className="grid grid-cols-[150px_1fr] gap-[26px] border-b border-line py-5 last:border-0 last:pb-0 max-desktop:grid-cols-[1fr] max-desktop:gap-3.5">
      <h3 className="m-0 text-sm font-medium">{title}</h3>
      {!visible ? <p className={MUTED_NOTE}>Hidden by one or both friends.</p> : (
        <div className="grid grid-cols-2 gap-7 max-tablet:gap-3.5">
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
    <div className={cx(side === "left" && "text-right")}>
      <p className="mb-[11px] mt-0 text-xs text-faint">{name}</p>
      {rows.length === 0 && <span className={MUTED_NOTE}>No activity in this window.</span>}
      {rows.map(([label, value]) => {
        const percentage = total ? Math.round(value / total * 100) : 0;
        return (
          <div key={label} className="mt-2.5">
            <span className={cx("flex justify-between gap-2.5", side === "left" && "flex-row-reverse")}>
              <b className="truncate text-xs font-semibold max-tablet:text-2xs">{label}</b>
              <small className="text-xs text-faint max-tablet:text-2xs">{percentage}%</small>
            </span>
            <i className="mt-[5px] block h-[5px] bg-canvas-deep">
              <em className={cx("block h-full bg-steel-3", side === "left" && "ml-auto")} style={{ width: `${percentage}%` }} />
            </i>
          </div>
        );
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
