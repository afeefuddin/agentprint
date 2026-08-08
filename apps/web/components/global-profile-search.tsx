"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

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

  return (
    <div ref={rootRef} className={`profile-search${mobileOpen ? " is-mobile-open" : ""}`}>
      <button className="profile-search-toggle" type="button" onClick={revealSearch} aria-label="Search public profiles">
        <Search size={17} />
      </button>
      <div className="profile-search-field">
        <Search size={15} aria-hidden="true" />
        <label className="sr-only" htmlFor="global-profile-search">Search public profiles</label>
        <input
          ref={inputRef}
          id="global-profile-search"
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
          <button type="button" onClick={() => { setQuery(""); resetResults(); inputRef.current?.focus(); }} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>
      {showPanel && (
        <div id="global-profile-results" className="profile-search-results" role="listbox" aria-label="Public profiles">
          <div className="profile-search-caption">
            <span><i /> Public profiles</span>
            <small>{loading ? "Searching…" : `${results.length} found`}</small>
          </div>
          {!loading && results.length === 0 && (
            <p className="profile-search-empty">No public profile matches “{normalized}”.</p>
          )}
          {results.map((result, index) => (
            <Link
              id={`global-profile-result-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              className="profile-search-result"
              href={`/${result.handle}`}
              key={result.handle}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={closeSearch}
            >
              <span aria-hidden="true">{initials(result.displayName)}</span>
              <div><b>{result.displayName}</b><small>@{result.handle}</small></div>
              <i aria-hidden="true">↗</i>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
