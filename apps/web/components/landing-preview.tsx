"use client";

import { useEffect, useRef, useState } from "react";

const columns = Array.from({ length: 53 }, (_, week) =>
  Array.from({ length: 7 }, (_, day) => {
    const hash =
      (Math.imul(week + 17, 1_103_515_245) ^
        Math.imul(day + 31, 12_345) ^
        Math.imul(week * day + 7, 2_654_435_761)) >>>
      0;
    const score = hash % 100;
    const weekend = day === 0 || day === 6;
    const quietStretch = (week >= 16 && week <= 18) || week === 37;
    const activeThreshold = weekend ? 78 : quietStretch ? 72 : 32;

    if (score < activeThreshold) return 0;
    const intensity = (score - activeThreshold) / (100 - activeThreshold);
    if (intensity < .46) return 1;
    if (intensity < .72) return 2;
    if (intensity < .9) return 3;
    return 4;
  })
);
const cells = columns.flat();
const heatInterval = 2_000;

function heatLevelAt(baseLevel: number, index: number, phase: number) {
  if (phase === 0) return baseLevel;

  const hash =
    (Math.imul(index + 11, 2_654_435_761) +
      Math.imul(phase + 7, 1_103_515_245)) >>>
    0;

  if (hash % 17 !== 0) return baseLevel;
  const direction = ((hash >>> 8) & 1) === 0 ? 1 : -1;
  return Math.max(0, Math.min(4, baseLevel + direction));
}

export function LandingPreview() {
  const [heatPhase, setHeatPhase] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const preview = previewRef.current;
    if (!preview) return;

    let interval = 0;
    let isVisible = false;
    let pageIsVisible = document.visibilityState === "visible";

    const stop = () => {
      if (!interval) return;
      window.clearInterval(interval);
      interval = 0;
    };

    const start = () => {
      if (interval || !isVisible || !pageIsVisible) return;
      interval = window.setInterval(() => {
        setHeatPhase((phase) => phase + 1);
      }, heatInterval);
    };

    const observer = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting;
      if (isVisible) start();
      else stop();
    });
    observer.observe(preview);

    const handleVisibilityChange = () => {
      pageIsVisible = document.visibilityState === "visible";
      if (pageIsVisible) start();
      else stop();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <div ref={previewRef} className="preview-stage">
      <div className="landing-instrument" aria-label="Example yearly agent activity field">
        <div className="instrument-grid" aria-hidden="true">
          {cells.map((level, index) => (
            <i
              key={index}
              data-level={heatLevelAt(level, index, heatPhase)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
