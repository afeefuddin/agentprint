"use client";

import { MoveHorizontal } from "lucide-react";
import { useState } from "react";

type ActivityDay = { date: string; tokens: number | null; level: number };
type TracePerson = { displayName: string; activity: ActivityDay[] };

export function ComparisonTrace({ mine, friend, windowDays }: { mine: TracePerson; friend: TracePerson; windowDays: 7 | 30 | 90 }) {
  const [focusedDetail, setFocusedDetail] = useState<string | null>(null);
  const [hoveredDetail, setHoveredDetail] = useState<string | null>(null);
  const middleIndex = Math.floor(mine.activity.length / 2);
  const activeDetail = focusedDetail ?? hoveredDetail ?? "Focus, hover, or tap a day to inspect its activity.";

  return (
    <section className="trace-panel" aria-labelledby="shared-trace-title">
      <div className="trace-panel-heading">
        <span><h2 id="shared-trace-title">Shared date rail</h2><small className="trace-live-detail" aria-live="polite">{activeDetail}</small></span>
        {windowDays === 90 && <span className="trace-scroll-hint"><MoveHorizontal size={14} /> Scroll to explore 90 days</span>}
      </div>
      <div className="trace-scroll" data-window={windowDays}>
        <div className="trace-rail">
          <TraceLane person={mine} windowDays={windowDays} side="top" onFocusDetail={setFocusedDetail} onHoverDetail={setHoveredDetail} />
          <div className="trace-date-axis" aria-hidden="true">
            <span>{formatDate(mine.activity[0].date)}</span>
            <i />
            <span>{formatDate(mine.activity[middleIndex].date)}</span>
            <i />
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
    <div className="comparison-trace-lane" data-side={side} style={{ gridTemplateColumns: `repeat(${windowDays}, minmax(6px, 1fr))` }} aria-label={`${person.displayName} daily activity`}>
      {person.activity.map((day) => {
        const activity = day.tokens === null ? `activity level ${day.level}` : `${day.tokens.toLocaleString()} tokens`;
        const detail = `${person.displayName} · ${formatLongDate(day.date)} · ${activity}`;
        return <button key={day.date} data-level={day.level} title={detail} aria-label={detail} onFocus={() => onFocusDetail(detail)} onBlur={() => onFocusDetail(null)} onMouseEnter={() => onHoverDetail(detail)} onMouseLeave={() => onHoverDetail(null)} onClick={() => onFocusDetail(detail)} />;
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
