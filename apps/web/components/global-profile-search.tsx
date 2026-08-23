"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cx } from "../lib/ui";

type SearchResult = {
  handle: string;
  displayName: string;
};

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

export function GlobalProfileSearch() {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  function closeSearch() {
    setOpen(false);
    setMobileOpen(false);
  }

  function resetResults() {
    setResults([]);
    setLoading(false);
    setActiveIndex(-1);
  }

  useEffect(() => {
    function closeOnOutsideClick(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setMobileOpen(false);
      }
    }
    document.addEventListener("pointerdown", closeOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeOnOutsideClick);
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    if (normalized.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/v1/profiles/search?q=${encodeURIComponent(normalized)}`, {
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Search failed");
        const body = await response.json() as { results: SearchResult[] };
        setResults(body.results);
        setActiveIndex(-1);
      } catch (error) {
        if ((error as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  function revealSearch() {
    setMobileOpen(true);
    setOpen(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      closeSearch();
      inputRef.current?.blur();
      return;
    }
    if (!results.length || !open) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? results.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      closeSearch();
      router.push(`/${results[activeIndex].handle}`);
    }
  }

  const normalized = query.trim();
  const showPanel = open && normalized.length >= 2;

  const fieldClass = cx(
    "flex min-h-[39px] items-center gap-2 rounded-full border border-line bg-panel-raised/70 px-[11px] text-faint transition-[border-color,box-shadow,background-color] duration-[140ms]",
    "focus-within:border-[color-mix(in_srgb,var(--color-blue)_38%,var(--color-line))] focus-within:bg-panel-raised focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-blue)_9%,transparent)]",
    mobileOpen
      ? "max-tablet:fixed max-tablet:inset-x-3.5 max-tablet:top-[calc(var(--header-h)+10px)] max-tablet:z-[22] max-tablet:min-h-[46px] max-tablet:px-3.5 max-tablet:shadow-[0_12px_38px_rgb(37_43_32_/_0.12)]"
      : "max-tablet:hidden"
  );
  const panelClass = cx(
    "absolute left-0 top-[calc(100%+10px)] w-full min-w-[300px] overflow-hidden rounded-md border border-line-strong bg-panel-raised shadow-[0_18px_50px_rgb(31_37_28_/_0.14)]",
    mobileOpen
      ? "max-tablet:fixed max-tablet:inset-x-3.5 max-tablet:top-[calc(var(--header-h)+64px)] max-tablet:z-[22] max-tablet:w-auto max-tablet:min-w-0"
      : "max-tablet:hidden"
  );

  return (
    <div ref={rootRef} className="relative ml-auto w-[min(320px,28vw)] max-desktop:w-[min(230px,26vw)] max-tablet:w-[38px]">
      <button
        className="hidden max-tablet:grid max-tablet:size-[38px] max-tablet:cursor-pointer max-tablet:place-items-center max-tablet:rounded-full max-tablet:border max-tablet:border-line max-tablet:bg-panel-raised/70 max-tablet:p-0 max-tablet:text-muted"
        type="button"
        onClick={revealSearch}
        aria-label="Search public profiles"
      >
        <Search size={17} />
      </button>
      <div className={fieldClass}>
        <Search size={15} aria-hidden="true" />
        <label className="sr-only" htmlFor="global-profile-search">Search public profiles</label>
        <input
          ref={inputRef}
          id="global-profile-search"
          className="w-full min-w-0 border-0 bg-transparent text-xs text-ink-strong outline-0 placeholder:text-faint"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showPanel}
          aria-controls="global-profile-results"
          aria-activedescendant={activeIndex >= 0 ? `global-profile-result-${activeIndex}` : undefined}
          autoComplete="off"
          placeholder="Search profiles"
          value={query}
          onChange={(event) => {
            const nextQuery = event.target.value;
            setQuery(nextQuery);
            if (nextQuery.trim().length < 2) {
              resetResults();
            }
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            type="button"
            className="grid size-6 flex-[0_0_24px] cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-faint hover:bg-canvas-deep hover:text-ink"
            onClick={() => { setQuery(""); resetResults(); inputRef.current?.focus(); }}
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>
      {showPanel && (
        <div id="global-profile-results" className={panelClass} role="listbox" aria-label="Public profiles">
          <div className="flex min-h-[37px] items-center justify-between border-b border-line px-[13px] text-2xs text-faint">
            <span className="flex items-center gap-[7px]">
              <i className="size-[5px] rounded-full bg-green shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-green)_12%,transparent)]" /> Public profiles
            </span>
            <small className="text-2xs">{loading ? "Searching…" : `${results.length} found`}</small>
          </div>
          {!loading && results.length === 0 && (
            <p className="m-0 px-4 py-[23px] text-center text-xs text-muted">No public profile matches “{normalized}”.</p>
          )}
          {results.map((result, index) => (
            <Link
              id={`global-profile-result-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className="grid min-h-[58px] grid-cols-[34px_1fr_auto] items-center gap-2.5 border-b border-line px-3 py-2 last:border-b-0 hover:bg-accent-soft aria-selected:bg-accent-soft"
              href={`/${result.handle}`}
              key={result.handle}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={closeSearch}
            >
              <span aria-hidden="true" className="grid size-[34px] place-items-center rounded-full border border-steel-2 text-2xs font-bold text-blue">
                {initials(result.displayName)}
              </span>
              <div className="min-w-0">
                <b className="block truncate text-xs font-semibold text-ink-strong">{result.displayName}</b>
                <small className="block truncate text-2xs text-faint">@{result.handle}</small>
              </div>
              <i aria-hidden="true" className="text-xs text-faint">↗</i>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
