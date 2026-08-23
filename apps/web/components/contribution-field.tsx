"use client";

import { intensityFor, formatTokens } from "@agentprint/analytics";
import { Layers3 } from "lucide-react";
import { KeyboardEvent, useMemo, useRef, useState } from "react";
import { cx, eyebrowClass } from "@/lib/ui";

const CELL_BASE =
  "h-3 rounded-[3px] border border-[color-mix(in_srgb,var(--color-line)_85%,transparent)] bg-canvas p-0 data-[level=1]:border-steel-1 data-[level=1]:bg-steel-1 data-[level=2]:border-steel-2 data-[level=2]:bg-steel-2 data-[level=3]:border-steel-3 data-[level=3]:bg-steel-3 data-[level=4]:border-steel-4 data-[level=4]:bg-steel-4";
const ACTIVITY_CELL = cx(
  CELL_BASE,
  "activity-cell w-full cursor-crosshair outline-none transition-[box-shadow,border-color] duration-[120ms]",
  "hover:relative hover:z-[2] hover:border-ink-strong hover:outline-2 hover:outline-panel hover:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-ink-strong)_16%,transparent)]",
  "focus:relative focus:z-[2] focus:border-ink-strong focus:outline-2 focus:outline-panel focus:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-ink-strong)_16%,transparent)]",
  "data-[selected]:relative data-[selected]:z-[2] data-[selected]:border-ink-strong data-[selected]:outline-2 data-[selected]:outline-panel data-[selected]:shadow-[0_0_0_2px_color-mix(in_srgb,var(--color-ink-strong)_16%,transparent)]"
);
const TRACE_META = "block text-xs text-faint";
const BAR_TONES = ["bg-steel-4", "bg-steel-3", "bg-amber"];

export type ActivityDay = {
  date: string;
  tokens: number;
  events: number;
  harnesses: Record<string, number>;
};

type Props = {
  activity: ActivityDay[];
  thresholds: readonly number[];
  showTokens?: boolean;
  showHarnesses?: boolean;
};

const harnessLabels: Record<string, string> = {
  codex: "Codex",
  "claude-code": "Claude Code",
  opencode: "OpenCode",
  "kimi-code": "Kimi Code",
  synthetic: "Synthetic"
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return isoDate(today);
}

function buildYear() {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setUTCDate(end.getUTCDate() + (6 - end.getUTCDay()));
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 370);
  return Array.from({ length: 371 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    return isoDate(date);
  });
}

export function ContributionField({
  activity,
  thresholds,
  showTokens = true,
  showHarnesses = true
}: Props) {
  const [harness, setHarness] = useState("all");
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const [year] = useState(() => buildYear());
  const lastIndex = useMemo(() => {
    const index = year.indexOf(todayIso());
    return index === -1 ? year.length - 1 : index;
  }, [year]);
  const [selected, setSelected] = useState<string>(() => year[lastIndex]);
  const monthLabels = useMemo(() => {
    const starts = year.flatMap((date, index) => {
      const value = new Date(`${date}T12:00:00Z`);
      return value.getUTCDate() === 1
        ? [{ label: value.toLocaleDateString("en", { month: "short", timeZone: "UTC" }), week: Math.floor(index / 7) }]
        : [];
    });
    return starts.map((month, index) => ({
      ...month,
      span: (starts[index + 1]?.week ?? 53) - month.week
    }));
  }, [year]);
  const activityMap = useMemo(
    () => new Map(activity.map((day) => [day.date, day])),
    [activity]
  );
  const harnesses = useMemo(
    () => [...new Set(activity.flatMap((day) => Object.keys(day.harnesses)))],
    [activity]
  );

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const directions: Record<string, number> = {
      ArrowRight: 7,
      ArrowLeft: -7,
      ArrowDown: 1,
      ArrowUp: -1
    };
    const offset = directions[event.key];
    if (!offset) return;
    event.preventDefault();
    const next = year[Math.max(0, Math.min(lastIndex, index + offset))];
    cellRefs.current.get(next)?.focus();
    setSelected(next);
  }

  return (
    <section className="w-full min-w-0 overflow-hidden" aria-labelledby="activity-title">
      <div className="flex min-h-[104px] items-center justify-between gap-6 py-6 max-tablet:flex-col max-tablet:items-start">
        <div>
          <span className={eyebrowClass}>
            <span className="ml-[3px] mr-[5px] inline-block size-1.5 rounded-full bg-green shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-green)_14%,transparent)]" /> Past 12 months
          </span>
          <h2 id="activity-title" className="mt-2.5 text-[25px] font-[weight:530] tracking-[-.025em] text-ink-strong">
            Agent contribution field
          </h2>
        </div>
        <div className="flex gap-2 max-tablet:w-full max-tablet:justify-between">
          {showHarnesses && (
            <label className="relative flex h-[35px] items-center rounded-sm border border-line bg-canvas pl-2.5 text-faint">
              <Layers3 size={14} />
              <span className="sr-only">Filter harness</span>
              <select
                className="h-[31px] cursor-pointer appearance-none border-0 bg-transparent pl-[7px] pr-7 text-xs font-medium text-ink outline-0"
                value={harness}
                onChange={(event) => setHarness(event.target.value)}
              >
                <option value="all">All harnesses</option>
                {harnesses.map((value) => (
                  <option value={value} key={value}>{harnessLabels[value] ?? value}</option>
                ))}
              </select>
            </label>
          )}
        </div>
      </div>
      <div
        className="min-w-0 overflow-x-auto pb-[29px] pt-[25px] outline-none"
        role="region"
        aria-label="Scrollable contribution calendar"
        tabIndex={0}
      >
        <div
          className="mb-2 ml-[38px] grid min-w-[920px] grid-cols-[repeat(53,1fr)] text-2xs font-medium text-faint"
          aria-hidden="true"
        >
          {monthLabels.map((month, index) => (
            <span
              key={`${month.label}-${index}`}
              style={{ gridColumn: `${month.week + 1} / span ${Math.max(1, month.span)}` }}
            >
              {month.label}
            </span>
          ))}
        </div>
        <div className="flex min-w-[956px] gap-[9px]">
          <div
            className="grid w-[29px] grid-rows-[repeat(7,12px)] gap-[3px] text-2xs font-medium leading-none text-faint"
            aria-hidden="true"
          >
            <span className="row-start-2">Mon</span><span className="row-start-4">Wed</span><span className="row-start-6">Fri</span>
          </div>
          <div
            className="grid flex-1 grid-flow-col grid-rows-[repeat(7,12px)] grid-cols-[repeat(53,minmax(12px,1fr))] gap-[3px]"
            role="grid"
            aria-label="Daily token activity"
          >
            {year.map((date, index) => {
              if (index > lastIndex) {
                return <span key={date} className={cx(ACTIVITY_CELL, "invisible")} role="presentation" aria-hidden="true" />;
              }
              const day = activityMap.get(date);
              const rawValue = day ? (harness === "all" ? day.tokens : day.harnesses[harness] ?? 0) : 0;
              const level = intensityFor(rawValue, thresholds);
              const label = showTokens
                ? `${new Date(`${date}T12:00:00Z`).toLocaleDateString("en", { dateStyle: "long" })}: ${formatTokens(rawValue)} tokens${day ? ` across ${day.events} records` : ""}`
                : `${new Date(`${date}T12:00:00Z`).toLocaleDateString("en", { dateStyle: "long" })}: ${day ? "activity recorded" : "no synced activity"}`;
              return (
                <button
                  key={date}
                  ref={(node) => {
                    if (node) cellRefs.current.set(date, node);
                    else cellRefs.current.delete(date);
                  }}
                  className={ACTIVITY_CELL}
                  data-level={level}
                  data-selected={selected === date || undefined}
                  role="gridcell"
                  aria-label={label}
                  title={label}
                  tabIndex={selected === date || (!selected && index === lastIndex) ? 0 : -1}
                  onFocus={() => setSelected(date)}
                  onMouseEnter={() => setSelected(date)}
                  onKeyDown={(event) => move(event, index)}
                >
                  <span className="sr-only">{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div
        className="grid min-h-[72px] grid-cols-[190px_118px_118px_1fr] items-center gap-[18px] border-y border-line py-3 max-tablet:grid-cols-2"
        aria-live="polite"
      >
        {selected && (() => {
          const day = activityMap.get(selected);
          return (
            <>
              <div>
                <b className="block text-xs font-[weight:520]">
                  {new Date(`${selected}T12:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}
                </b>
                <span className={TRACE_META}>{day ? `${day.events} accepted records` : "No synced activity"}</span>
              </div>
              {showTokens && (
                <div className="border-l border-line pl-[18px]">
                  <b className="text-base font-[weight:540]">{formatTokens(day?.tokens ?? 0)}</b>
                  <span className={TRACE_META}>tokens</span>
                </div>
              )}
              <div className="flex h-[5px] overflow-hidden bg-line max-tablet:col-span-full" aria-label="Harness composition">
                {day && Object.entries(day.harnesses).sort((a, b) => b[1] - a[1]).map(([name, tokens], position) => (
                  <span
                    key={name}
                    className={BAR_TONES[position] ?? ""}
                    style={{ flex: tokens }}
                    title={`${harnessLabels[name] ?? name}: ${formatTokens(tokens)} tokens`}
                  />
                ))}
              </div>
            </>
          );
        })()}
      </div>
      <div className="flex items-center gap-1 py-3.5 text-xs text-faint">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => <i key={level} className={cx(CELL_BASE, "w-3")} data-level={level} />)}
        <span>More</span>
      </div>
    </section>
  );
}
