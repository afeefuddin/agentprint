"use client";

import { intensityFor, formatTokens } from "@agentprint/analytics";
import { CalendarDays, Layers3, Sigma } from "lucide-react";
import { KeyboardEvent, useMemo, useRef, useState } from "react";

export type ActivityDay = {
  date: string;
  tokens: number;
  costMicros: number;
  events: number;
  harnesses: Record<string, number>;
};

type Props = {
  activity: ActivityDay[];
  thresholds: readonly number[];
  showTokens?: boolean;
  showCost?: boolean;
  showHarnesses?: boolean;
};

const harnessLabels: Record<string, string> = {
  codex: "Codex",
  "claude-code": "Claude Code",
  opencode: "OpenCode",
  synthetic: "Synthetic"
};

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
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
  showCost = true,
  showHarnesses = true
}: Props) {
  const [harness, setHarness] = useState("all");
  const [mode, setMode] = useState<"daily" | "cumulative">("daily");
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const [year] = useState(() => buildYear());
  const [selected, setSelected] = useState<string>(() => year[year.length - 1]);
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
  const visibleValues = activity.map((day) =>
    harness === "all" ? day.tokens : day.harnesses[harness] ?? 0
  );
  const maxCumulative = visibleValues.reduce((sum, value) => sum + value, 0);
  const cumulativeValues = year.reduce<number[]>((values, date, index) => {
    const day = activityMap.get(date);
    const raw = day ? (harness === "all" ? day.tokens : day.harnesses[harness] ?? 0) : 0;
    values.push((values[index - 1] ?? 0) + raw);
    return values;
  }, []);

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
    const next = year[Math.max(0, Math.min(year.length - 1, index + offset))];
    cellRefs.current.get(next)?.focus();
    setSelected(next);
  }

  return (
    <section className="field-shell" aria-labelledby="activity-title">
      <div className="field-header">
        <div>
          <span className="eyebrow"><span className="live-dot" /> Past 12 months</span>
          <h2 id="activity-title">Agent contribution field</h2>
        </div>
        <div className="field-controls">
          {showHarnesses && (
            <label className="select-control">
              <Layers3 size={14} />
              <span className="sr-only">Filter harness</span>
              <select value={harness} onChange={(event) => setHarness(event.target.value)}>
                <option value="all">All harnesses</option>
                {harnesses.map((value) => (
                  <option value={value} key={value}>{harnessLabels[value] ?? value}</option>
                ))}
              </select>
            </label>
          )}
          <div className="segmented" aria-label="Activity calculation">
            <button className={mode === "daily" ? "active" : ""} onClick={() => setMode("daily")} aria-pressed={mode === "daily"}>
              <CalendarDays size={13} /> Daily
            </button>
            <button className={mode === "cumulative" ? "active" : ""} onClick={() => setMode("cumulative")} aria-pressed={mode === "cumulative"}>
              <Sigma size={13} /> Cumulative
            </button>
          </div>
        </div>
      </div>
      <div className="field-scroll" role="region" aria-label="Scrollable contribution calendar" tabIndex={0}>
        <div className="month-labels" aria-hidden="true">
          {monthLabels.map((month, index) => (
            <span
              key={`${month.label}-${index}`}
              style={{ gridColumn: `${month.week + 1} / span ${Math.max(1, month.span)}` }}
            >
              {month.label}
            </span>
          ))}
        </div>
        <div className="field-body">
          <div className="weekday-labels" aria-hidden="true">
            <span>Mon</span><span>Wed</span><span>Fri</span>
          </div>
          <div className="contribution-grid" role="grid" aria-label="Daily token activity">
            {year.map((date, index) => {
              const day = activityMap.get(date);
              const rawValue = day ? (harness === "all" ? day.tokens : day.harnesses[harness] ?? 0) : 0;
              const value = mode === "daily" ? rawValue : cumulativeValues[index];
              const level = mode === "daily"
                ? intensityFor(value, thresholds)
                : value === 0 ? 0 : Math.max(1, Math.ceil((value / Math.max(1, maxCumulative)) * 4));
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
                  className="activity-cell"
                  data-level={level}
                  data-selected={selected === date || undefined}
                  role="gridcell"
                  aria-label={label}
                  title={label}
                  tabIndex={selected === date || (!selected && index === year.length - 1) ? 0 : -1}
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
      <div className="trace-reader" aria-live="polite">
        {selected && (() => {
          const day = activityMap.get(selected);
          return (
            <>
              <div className="trace-date">
                <b>{new Date(`${selected}T12:00:00Z`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" })}</b>
                <span>{day ? `${day.events} accepted records` : "No synced activity"}</span>
              </div>
              {showTokens && <div className="trace-total">
                <b>{formatTokens(day?.tokens ?? 0)}</b><span>tokens</span>
              </div>}
              {showCost && <div className="trace-total"><b>${((day?.costMicros ?? 0) / 1_000_000).toFixed(2)}</b><span>estimated</span></div>}
              <div className="trace-bars" aria-label="Harness composition">
                {day && Object.entries(day.harnesses).sort((a, b) => b[1] - a[1]).map(([name, tokens]) => (
                  <span key={name} style={{ flex: tokens }} title={`${harnessLabels[name] ?? name}: ${formatTokens(tokens)} tokens`} />
                ))}
              </div>
            </>
          );
        })()}
      </div>
      <div className="field-footer">
        <span>Less</span>
        {[0, 1, 2, 3, 4].map((level) => <i key={level} className="legend-cell" data-level={level} />)}
        <span>More</span>
      </div>
    </section>
  );
}
