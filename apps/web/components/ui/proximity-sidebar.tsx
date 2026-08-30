"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue
} from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/ui";

type Side = "left" | "right";
type SectionKind = "title" | "subtitle" | "section" | "body";

export type ProximitySection = {
  id: string;
  label: string;
  kind?: SectionKind;
};

type ProximitySidebarProps = {
  activeOffset?: number;
  className?: string;
  sections: ProximitySection[];
  side?: Side;
};

type DashPreset = {
  base: number;
  bump: number;
  className: string;
};

type DashProps = {
  active: boolean;
  mouseY: MotionValue<number>;
  onSelect: (id: string) => void;
  registerDash: (id: string, node: HTMLButtonElement | null) => void;
  section: ProximitySection;
  side: Side;
};

const RADIUS = 42;
const MAX_DASH_WIDTH = 96;
const SCROLL_IDLE_RESET_DELAY = 100;

const dashPresets: Record<SectionKind, DashPreset> = {
  title: { base: 38, bump: 58, className: "bg-accent" },
  subtitle: { base: 32, bump: 58, className: "bg-ink-strong" },
  section: { base: 27, bump: 52, className: "bg-muted/70" },
  body: { base: 20, bump: 48, className: "bg-faint/55" }
};

function getSectionElement(id: string) {
  return typeof document === "undefined" ? null : document.getElementById(id);
}

function getScrollParent(element: HTMLElement) {
  let parent = element.parentElement;
  while (parent) {
    if (/(auto|scroll|overlay)/.test(window.getComputedStyle(parent).overflowY)) return parent;
    parent = parent.parentElement;
  }
  return window;
}

function findActiveSection(sections: ProximitySection[], anchorY: number) {
  let low = 0;
  let high = sections.length - 1;
  let activeId = sections[0]?.id;

  while (low <= high) {
    const middle = Math.floor((low + high) / 2);
    const section = sections[middle];
    const element = section ? getSectionElement(section.id) : null;

    if (!element) {
      high = middle - 1;
      continue;
    }

    if (element.getBoundingClientRect().top <= anchorY) {
      activeId = section.id;
      low = middle + 1;
    } else {
      high = middle - 1;
    }
  }

  return activeId;
}

function Dash({ active, mouseY, onSelect, registerDash, section, side }: DashProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const preset = dashPresets[section.kind ?? "body"];

  useEffect(() => {
    registerDash(section.id, ref.current);
    return () => registerDash(section.id, null);
  }, [registerDash, section.id]);

  const distance = useTransform(mouseY, (pointerY) => {
    const rect = ref.current?.getBoundingClientRect();
    return rect ? pointerY - (rect.top + rect.height / 2) : RADIUS;
  });
  const targetScaleX = useTransform(
    distance,
    [-RADIUS, 0, RADIUS],
    [preset.base / MAX_DASH_WIDTH, (preset.base + preset.bump) / MAX_DASH_WIDTH, preset.base / MAX_DASH_WIDTH],
    { clamp: true }
  );
  const scaleX = useSpring(targetScaleX, { stiffness: 320, damping: 34, mass: 0.7 });

  return (
    <button
      ref={ref}
      type="button"
      aria-current={active ? "location" : undefined}
      aria-label={`Go to ${section.label}`}
      title={section.label}
      className="group flex h-px w-24 shrink-0 items-center border-0 bg-transparent p-0 outline-none"
      onClick={() => onSelect(section.id)}
    >
      <motion.span
        className={cn(
          "block h-px w-24 transition-colors duration-150 group-focus-visible:ring-2 group-focus-visible:ring-accent group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-canvas",
          preset.className
        )}
        style={{ scaleX, transformOrigin: side === "left" ? "left center" : "right center" }}
      />
    </button>
  );
}

export function ProximitySidebar({
  activeOffset = 0.4,
  className,
  sections,
  side = "right"
}: ProximitySidebarProps) {
  const mouseY = useMotionValue(Number.POSITIVE_INFINITY);
  const reduceMotion = useReducedMotion();
  const dashRefs = useRef(new Map<string, HTMLButtonElement>());
  const pointerInside = useRef(false);
  const resetTimer = useRef<number | null>(null);
  const [activeId, setActiveId] = useState(sections[0]?.id);
  const sectionIds = useMemo(() => sections.map((section) => section.id).join("|"), [sections]);
  const gap = sections.length > 1
    ? `min(8px, max(0px, calc((100% - ${sections.length}px) / ${sections.length - 1})))`
    : 0;

  const registerDash = useCallback((id: string, node: HTMLButtonElement | null) => {
    if (node) dashRefs.current.set(id, node);
    else dashRefs.current.delete(id);
  }, []);

  const clearPendingReset = useCallback(() => {
    if (resetTimer.current === null) return;
    window.clearTimeout(resetTimer.current);
    resetTimer.current = null;
  }, []);

  const setMouseToDash = useCallback((id?: string) => {
    if (!id) {
      mouseY.set(Number.POSITIVE_INFINITY);
      return;
    }
    const rect = dashRefs.current.get(id)?.getBoundingClientRect();
    if (rect) mouseY.set(rect.top + rect.height / 2);
  }, [mouseY]);

  const pulseDash = useCallback((id?: string) => {
    setMouseToDash(id);
    clearPendingReset();
    if (!id || pointerInside.current) return;
    resetTimer.current = window.setTimeout(() => {
      mouseY.set(Number.POSITIVE_INFINITY);
      resetTimer.current = null;
    }, SCROLL_IDLE_RESET_DELAY);
  }, [clearPendingReset, mouseY, setMouseToDash]);

  const selectSection = useCallback((id: string) => {
    const element = getSectionElement(id);
    if (!element) return;
    element.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
    setActiveId(id);
    pulseDash(id);
  }, [pulseDash, reduceMotion]);

  useEffect(() => () => clearPendingReset(), [clearPendingReset]);

  useEffect(() => {
    if (sections.length === 0) return;
    let frame = 0;

    const updateActiveSection = () => {
      frame = 0;
      const nextActiveId = findActiveSection(sections, window.innerHeight * activeOffset);
      setActiveId(nextActiveId);
      if (!pointerInside.current) pulseDash(nextActiveId);
    };
    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveSection);
    };
    const scrollParents = new Set<EventTarget>([window]);
    for (const section of sections) {
      const element = getSectionElement(section.id);
      if (element) scrollParents.add(getScrollParent(element));
    }

    updateActiveSection();
    for (const parent of scrollParents) parent.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      for (const parent of scrollParents) parent.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [activeOffset, pulseDash, sectionIds, sections]);

  if (sections.length === 0) return null;

  return (
    <nav
      aria-label="Session turns"
      className={cn("flex h-full min-h-0 items-center", side === "left" ? "justify-start" : "justify-end", className)}
    >
      <div
        className={cn("flex h-full flex-col justify-center", side === "right" ? "items-end" : "items-start")}
        style={{ gap }}
        onPointerMove={(event) => {
          clearPendingReset();
          pointerInside.current = true;
          mouseY.set(event.clientY);
        }}
        onPointerLeave={() => {
          pointerInside.current = false;
          mouseY.set(Number.POSITIVE_INFINITY);
        }}
      >
        {sections.map((section) => (
          <Dash
            key={section.id}
            active={section.id === activeId}
            mouseY={mouseY}
            onSelect={selectSection}
            registerDash={registerDash}
            section={section}
            side={side}
          />
        ))}
      </div>
    </nav>
  );
}
