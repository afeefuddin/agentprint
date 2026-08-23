import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ArrowRight, LockKeyhole } from "lucide-react";
import { formatTokens } from "@agentprint/analytics";
import { getFriendComparison } from "@agentprint/database";
import { ComparisonTrace } from "@/components/comparison-trace";
import { requireViewer } from "@/lib/auth";
import { SiteHeader } from "@/components/site-header";
import { notFound } from "next/navigation";
import { harnessBrand, harnessLabels, modelBrand } from "@/lib/brands";
import { appMainClass, avatarChipClass, cx } from "@/lib/ui";

export const metadata: Metadata = { title: "Friend comparison" };

const comparisonWindows = [7, 30, 90] as const;

const PANEL = "mt-9 overflow-hidden rounded-md border border-line bg-panel";
const PANEL_TITLE = "m-0 block text-lg font-medium tracking-[-.015em] text-ink-strong";
const PANEL_SUB = "mt-1.5 block text-sm leading-[1.5] text-faint";
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
      <section
        className="mt-9 overflow-hidden rounded-md border border-line bg-panel shadow-[0_1px_2px_color-mix(in_srgb,var(--color-ink-strong)_5%,transparent)]"
        aria-labelledby="comparison-title"
      >
        <div
          className="grid grid-cols-[1fr_minmax(180px,.4fr)_1fr] items-center border-b border-line-strong px-7 py-5 max-tablet:grid-cols-[1fr_42px_1fr] max-tablet:px-[18px]"
          aria-label="Friends being compared"
        >
          <TraceIdentity person={mine} side="left" />
          <span className="grid grid-cols-[1fr_auto_1fr] items-center gap-[9px] text-blue max-tablet:grid-cols-[1fr] max-tablet:justify-items-center">
            <i className="h-px bg-steel-2 max-tablet:hidden" /><LockKeyhole size={14} /><i className="h-px bg-steel-2 max-tablet:hidden" />
          </span>
          <TraceIdentity person={friend} side="right" />
        </div>
        <div className="flex items-center justify-between gap-8 px-7 py-[18px] max-tablet:flex-col max-tablet:items-stretch max-tablet:gap-4 max-tablet:px-[18px]">
          <span>
            <h1 id="comparison-title" className="m-0 text-lg font-medium tracking-[-.015em] text-ink-strong">Activity comparison</h1>
          </span>
          <nav
            className="flex shrink-0 overflow-hidden rounded-sm border border-line-strong bg-canvas max-tablet:w-full"
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
        </div>
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

      <section className="mt-9" aria-labelledby="routing-title">
        <div className={cx(HEADING_ROW, "mb-3.5 border-b border-line")}>
          <span>
            <h2 id="routing-title" className={PANEL_TITLE}>Routing fingerprints</h2>
            <small className={PANEL_SUB}>How each activity history moved across coding tools and models.</small>
          </span>
          <ArrowRight size={16} className="text-faint" />
        </div>
        <div className="grid gap-3.5">
          <RoutingComparison
            title="Coding-tool mix"
            description="Share of tokens routed through each coding tool"
            left={mine}
            right={friend}
            field="harnesses"
            visible={comparison.visibility.harnesses}
          />
          <RoutingComparison
            title="Model routing"
            description="Relative token volume across the most-used models"
            left={mine}
            right={friend}
            field="models"
            visible={comparison.visibility.models}
          />
        </div>
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

function RoutingComparison({
  title,
  description,
  left,
  right,
  field,
  visible
}: {
  title: string;
  description: string;
  left: { displayName: string; harnesses: Record<string, number>; models: Record<string, number> };
  right: { displayName: string; harnesses: Record<string, number>; models: Record<string, number> };
  field: "harnesses" | "models";
  visible: boolean;
}) {
  return (
    <article className="rounded-md border border-line bg-panel p-6 shadow-[0_1px_2px_color-mix(in_srgb,var(--color-ink-strong)_4%,transparent)] max-tablet:p-[18px]">
      <div className="mb-4 flex items-end justify-between gap-5 max-tablet:items-start">
        <span>
          <h3 className="m-0 text-base font-semibold text-ink-strong">{title}</h3>
          <small className="mt-1.5 block text-sm leading-[1.45] text-faint">{description}</small>
        </span>
      </div>
      {!visible ? <p className={MUTED_NOTE}>Hidden by one or both friends.</p> : (
        <RoutingList left={left} right={right} field={field} />
      )}
    </article>
  );
}

function RoutingList({
  left,
  right,
  field
}: {
  left: { displayName: string; harnesses: Record<string, number>; models: Record<string, number> };
  right: { displayName: string; harnesses: Record<string, number>; models: Record<string, number> };
  field: "harnesses" | "models";
}) {
  const leftValues = left[field];
  const rightValues = right[field];
  const leftTotal = Object.values(leftValues).reduce((sum, value) => sum + value, 0);
  const rightTotal = Object.values(rightValues).reduce((sum, value) => sum + value, 0);
  const routes = [...new Set([...Object.keys(leftValues), ...Object.keys(rightValues)])]
    .sort((a, b) => Math.max(rightValues[b] ?? 0, leftValues[b] ?? 0) - Math.max(rightValues[a] ?? 0, leftValues[a] ?? 0));
  return (
    <div className="overflow-hidden rounded-sm border border-line bg-panel" role="table" aria-label={`${field === "harnesses" ? "Coding tool" : "Model"} routing comparison`}>
      <div className="grid min-h-[48px] grid-cols-[minmax(0,1fr)_168px_minmax(0,1fr)] items-center border-b border-line bg-canvas-deep/55 px-4 max-tablet:grid-cols-[minmax(0,1fr)_104px_minmax(0,1fr)] max-tablet:px-2.5" role="row">
        <b className="truncate pr-2 text-right text-sm font-semibold text-ink-strong" role="columnheader">{left.displayName}</b>
        <span className="text-center text-sm text-faint" role="columnheader">Route</span>
        <b className="truncate pl-2 text-left text-sm font-semibold text-ink-strong" role="columnheader">{right.displayName}</b>
      </div>
      {routes.length === 0 && <p className="m-0 px-4 py-[18px] text-sm text-faint">No activity in this window.</p>}
      {routes.map((route) => {
        const leftPercentage = leftTotal ? Math.round((leftValues[route] ?? 0) / leftTotal * 100) : 0;
        const rightPercentage = rightTotal ? Math.round((rightValues[route] ?? 0) / rightTotal * 100) : 0;
        const brand = field === "harnesses" ? harnessBrand(route) : modelBrand(route);
        return (
          <div className="grid min-h-[82px] grid-cols-[minmax(0,1fr)_168px_minmax(0,1fr)] items-center border-b border-line px-4 last:border-b-0 max-tablet:min-h-[78px] max-tablet:grid-cols-[minmax(0,1fr)_104px_minmax(0,1fr)] max-tablet:px-2.5" role="row" key={route}>
            <span className="grid min-w-0 grid-cols-[34px_minmax(0,1fr)] items-center gap-2" role="cell">
              <b className="text-right text-sm font-semibold [font-variant-numeric:tabular-nums]">{leftPercentage}%</b>
              <i className="block h-2 overflow-hidden rounded-full bg-canvas-deep">
                <em className="ml-auto block h-full rounded-full" style={{ width: `${leftPercentage}%`, background: brand.color }} />
              </i>
            </span>
            <span className="flex min-w-0 flex-col items-center justify-center gap-1.5 border-x border-line self-stretch px-2 py-2.5 text-center" role="rowheader">
              <i className="grid size-[30px] shrink-0 place-items-center rounded-full border border-line bg-canvas">
                {brand.logo
                  ? <Image src={brand.logo} alt="" width={16} height={16} className="size-4 object-contain" />
                  : <em className="size-2.5 rounded-full" style={{ background: brand.color }} />}
              </i>
              <b className="min-w-0 max-w-full text-sm font-medium leading-[1.2] text-muted [overflow-wrap:anywhere]">{routingLabel(route, field)}</b>
            </span>
            <span className="grid min-w-0 grid-cols-[minmax(0,1fr)_34px] items-center gap-2" role="cell">
              <i className="block h-2 overflow-hidden rounded-full bg-canvas-deep">
                <em className="block h-full rounded-full" style={{ width: `${rightPercentage}%`, background: brand.color }} />
              </i>
              <b className="text-left text-sm font-semibold [font-variant-numeric:tabular-nums]">{rightPercentage}%</b>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function routingLabel(label: string, field: "harnesses" | "models") {
  return field === "harnesses" ? harnessLabels[label] ?? harnessBrand(label).label : label;
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
