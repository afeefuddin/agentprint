"use client";

import { MoveHorizontal } from "lucide-react";
import { useState } from "react";
import { cx } from "@/lib/ui";

const LANE_CELL =
  "relative h-[29px] min-w-0 cursor-crosshair border border-[color-mix(in_srgb,var(--color-line)_75%,transparent)] bg-canvas-deep p-0 transition-[transform,border-color,background-color] duration-100 data-[level=1]:border-steel-1 data-[level=1]:bg-steel-1 data-[level=2]:border-steel-2 data-[level=2]:bg-steel-2 data-[level=3]:border-steel-3 data-[level=3]:bg-steel-3 data-[level=4]:border-steel-4 data-[level=4]:bg-steel-4 hover:z-[3] hover:scale-y-[1.16] hover:border-blue focus-visible:z-[3] focus-visible:scale-y-[1.16] focus-visible:border-blue focus-visible:outline-0";

type ActivityDay = { date: string; tokens: number | null; level: number };
type TracePerson = { displayName: string; activity: ActivityDay[] };

export function ComparisonTrace({ mine, friend, windowDays }: { mine: TracePerson; friend: TracePerson; windowDays: 7 | 30 | 90 }) {
  const [focusedDetail, setFocusedDetail] = useState<string | null>(null);
  const [hoveredDetail, setHoveredDetail] = useState<string | null>(null);
  const middleIndex = Math.floor(mine.activity.length / 2);
  const activeDetail = focusedDetail ?? hoveredDetail ?? "Focus, hover, or tap a day to inspect its activity.";

  return (
    <section
      className="mt-[18px] overflow-hidden rounded-md border border-line-strong bg-panel p-5 max-tablet:p-3.5"
      aria-labelledby="shared-trace-title"
    >
      <div className="flex items-center justify-between gap-5 pb-[18px]">
        <span>
          <h2 id="shared-trace-title" className="m-0 block text-sm font-semibold text-ink-strong">Shared date rail</h2>
          <small className="trace-live-detail mt-[3px] block min-h-[18px] text-xs text-muted" aria-live="polite">{activeDetail}</small>
        </span>
        {windowDays === 90 && (
          <span className="hidden items-center gap-[7px] text-xs text-faint max-tablet:inline-flex max-tablet:flex-col max-tablet:items-end max-tablet:text-right">
            <MoveHorizontal size={14} /> Scroll to explore 90 days
          </span>
        )}
      </div>
      <div className="trace-scroll overflow-x-auto pb-3 pt-1 [scrollbar-color:var(--color-steel-2)_transparent] [scrollbar-width:thin]">
        <div className={cx("min-w-full", windowDays === 90 && "min-w-[760px]")}>
          <TraceLane person={mine} windowDays={windowDays} side="top" onFocusDetail={setFocusedDetail} onHoverDetail={setHoveredDetail} />
          <div className="grid min-h-7 grid-cols-[auto_1fr_auto_1fr_auto] items-center text-2xs text-faint" aria-hidden="true">
            <span>{formatDate(mine.activity[0].date)}</span>
            <i className="mx-[9px] h-px bg-line" />
            <span>{formatDate(mine.activity[middleIndex].date)}</span>
            <i className="mx-[9px] h-px bg-line" />
            <span>{formatDate(mine.activity.at(-1)!.date)}</span>
          </div>
          <TraceLane person={friend} windowDays={windowDays} side="bottom" onFocusDetail={setFocusedDetail} onHoverDetail={setHoveredDetail} />
        </div>
      </div>
    </section>
  );
}

function TraceLane({
  person,
  windowDays,
  side,
  onFocusDetail,
  onHoverDetail
}: {
  person: TracePerson;
  windowDays: number;
  side: "top" | "bottom";
  onFocusDetail: (detail: string | null) => void;
  onHoverDetail: (detail: string | null) => void;
}) {
  return (
    <div
      className="grid gap-[3px]"
      style={{ gridTemplateColumns: `repeat(${windowDays}, minmax(6px, 1fr))` }}
      aria-label={`${person.displayName} daily activity`}
    >
      {person.activity.map((day) => {
        const activity = day.tokens === null ? `activity level ${day.level}` : `${day.tokens.toLocaleString()} tokens`;
        const detail = `${person.displayName} · ${formatLongDate(day.date)} · ${activity}`;
        return <button key={day.date} className={cx(LANE_CELL, side === "top" ? "origin-bottom" : "origin-top")} data-level={day.level} title={detail} aria-label={detail} onFocus={() => onFocusDetail(detail)} onBlur={() => onFocusDetail(null)} onMouseEnter={() => onHoverDetail(detail)} onMouseLeave={() => onHoverDetail(null)} onClick={() => onFocusDetail(detail)} />;
      })}
    </div>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

function formatLongDate(date: string) {
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}
