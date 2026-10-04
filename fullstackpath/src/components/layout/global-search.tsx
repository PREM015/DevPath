"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export type SearchHit = {
  id: string;
  kind: "phase" | "group" | "topic" | "resource" | "note";
  title: string;
  context: string;
  href: string;
  difficulty?: string;
};

type SearchResponse = { results: SearchHit[] } | { error: string };

/** Shared empty array so the derived state does not change identity per render. */
const EMPTY_RESULTS: SearchHit[] = [];

/**
 * Global search across roadmap content and the user's own notes.
 *
 * Results are scoped on the server: phases, groups, topics and resources are
 * shared, notes are filtered to the signed-in user inside the query itself.
 */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchHit[]>([]);
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Debounced query. 200ms is short enough to feel instant and long enough to
  // avoid a request per keystroke.
  React.useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}`, {
          signal: controller.signal,
        });
        if (!response.ok) return;
        const data = (await response.json()) as SearchResponse;
        if (!("results" in data)) return;
        // Ignore a response that arrived after the query moved on.
        if (controller.signal.aborted) return;
        setResults(data.results);
        setActiveIndex(0);
      } catch {
        // Aborted or offline: leave the previous results in place.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Results and the loading flag are derived from the query rather than set
  // inside the effect, so clearing the box does not require a second render pass.
  const trimmedQuery = query.trim();
  const isTooShort = trimmedQuery.length < 2;
  const visibleResults = isTooShort ? EMPTY_RESULTS : results;
  const showPanel = open && !isTooShort;

  // Cmd/Ctrl+K focuses search from anywhere.
  React.useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  React.useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function go(hit: SearchHit) {
    setOpen(false);
    setQuery("");
    router.push(hit.href);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!showPanel || visibleResults.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % visibleResults.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index - 1 + visibleResults.length) % visibleResults.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = visibleResults[activeIndex];
      if (hit) go(hit);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        {loading ? (
          <Loader2 className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        )}
        <Input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={showPanel && visibleResults.length > 0}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          aria-label="Search roadmap and notes"
          placeholder="Search topics, groups, notes…"
          className="h-8 border-transparent bg-muted/60 pl-8 pr-14 text-sm focus-visible:bg-background"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
          ⌘K
        </kbd>
      </div>

      {showPanel && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-xl border border-border bg-popover p-1 shadow-card-hover animate-scale-in"
          role="listbox"
          id="global-search-results"
        >
          {visibleResults.length === 0 && !loading && (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No matches for “{query.trim()}”.
            </p>
          )}
          {visibleResults.map((hit, index) => (
            <button
              key={`${hit.kind}-${hit.id}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => go(hit)}
              className={cn(
                "flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition-colors",
                index === activeIndex ? "bg-secondary" : "hover:bg-secondary/60",
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{hit.title}</p>
                <p className="truncate text-xs text-muted-foreground">{hit.context}</p>
              </div>
              <Badge variant="outline" className="mt-0.5 shrink-0">
                {hit.kind}
              </Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}