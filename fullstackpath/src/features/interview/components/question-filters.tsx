"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type PhaseOption = { id: string; order: number; title: string };

const RESULT_OPTIONS = [
  { value: "", label: "Any result" },
  { value: "unattempted", label: "Never attempted" },
  { value: "BLANK", label: "Went blank" },
  { value: "PARTIAL", label: "Partial" },
  { value: "CONFIDENT", label: "Confident" },
];

const DIFFICULTY_OPTIONS = [
  { value: "", label: "Any difficulty" },
  { value: "BEGINNER", label: "Beginner" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
  { value: "SENIOR", label: "Senior" },
];

/**
 * Filter bar for the question bank.
 *
 * The selects apply immediately. Previously the bar was a plain GET form, so a
 * learner could change a dropdown, see the new value sitting in the control and
 * assume the list had updated, when the list was still whatever the last page
 * load returned. Worse, a browser back/forward restore repaints the controls to
 * their previous values while serving the stale page, which looks identical to
 * the filter being broken.
 *
 * Applying on change removes the gap between "chosen" and "shown". The form
 * element and its `method="get"` are kept so the bar still works with
 * JavaScript disabled or before hydration, and the text search still submits
 * explicitly because typing should not fire a request per keystroke.
 */
export function QuestionFilters({
  phases,
  total,
  totalAll,
  stats,
}: {
  phases: PhaseOption[];
  total: number;
  totalAll: number;
  stats: { blank: number; unattempted: number; partial: number; confident: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const phase = searchParams.get("phase") ?? "";
  const result = searchParams.get("result") ?? "";
  const difficulty = searchParams.get("difficulty") ?? "";

  // The search box is uncontrolled so typing does not re-render the page. Keying
  // it on the URL value means a change from elsewhere - a chip, the Reset
  // button, the browser's back button - remounts the field with the new term,
  // which is cheaper and clearer than syncing it through an effect.
  const [term, setTerm] = React.useState(q);

  /** Push new params, always returning to page 1. */
  const apply = React.useCallback(
    (patch: Record<string, string>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      next.delete("page");
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const selectClass =
    "h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const chips = [
    q ? { key: "q", label: `Search: "${q}"` } : null,
    phase
      ? {
          key: "phase",
          label: phases.find((item) => item.id === phase)?.title ?? "Phase",
        }
      : null,
    result
      ? { key: "result", label: `Result: ${RESULT_OPTIONS.find((o) => o.value === result)?.label ?? result}` }
      : null,
    difficulty
      ? {
          key: "difficulty",
          label: `Difficulty: ${DIFFICULTY_OPTIONS.find((o) => o.value === difficulty)?.label ?? difficulty}`,
        }
      : null,
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));

  return (
    <Card>
      <CardContent className="p-4">
        <form
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
          method="get"
          action={pathname}
          onSubmit={(event) => {
            // With JS active the dropdowns already applied; the form submit
            // only carries the search term.
            event.preventDefault();
            apply({ q: term });
          }}
        >
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              key={q}
              name="q"
              defaultValue={q}
              onChange={(event) => setTerm(event.target.value)}
              placeholder="Search questions…"
              aria-label="Search questions"
              className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <select
            name="phase"
            value={phase}
            onChange={(event) => apply({ phase: event.target.value })}
            aria-label="Filter by phase"
            className={cn(selectClass, "cursor-pointer")}
          >
            <option value="">All phases</option>
            {phases.map((option) => (
              <option key={option.id} value={option.id}>
                {option.order}. {option.title}
              </option>
            ))}
          </select>

          <select
            name="result"
            value={result}
            onChange={(event) => apply({ result: event.target.value })}
            aria-label="Filter by how you answered"
            className={cn(selectClass, "cursor-pointer")}
          >
            {RESULT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <select
            name="difficulty"
            value={difficulty}
            onChange={(event) => apply({ difficulty: event.target.value })}
            aria-label="Filter by difficulty"
            className={cn(selectClass, "cursor-pointer")}
          >
            {DIFFICULTY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="submit" size="sm" variant="outline">
              Search
            </Button>
            {chips.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setTerm("");
                  router.push(pathname, { scroll: false });
                }}
              >
                <X />
                Reset
              </Button>
            )}
            <span className="ml-auto self-center text-xs text-muted-foreground" aria-live="polite">
              {total.toLocaleString()} match{total === 1 ? "" : "es"}
              {total !== totalAll && (
                <span className="text-muted-foreground/70"> of {totalAll.toLocaleString()}</span>
              )}
            </span>
          </div>
        </form>

        {/* Applied filters, spelled out and individually removable, so a stale
            render is obvious rather than looking like a working filter. */}
        {chips.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border pt-3">
            <span className="text-xs text-muted-foreground">Showing</span>
            {chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => apply({ [chip.key]: "" })}
                className="rounded-full border border-border bg-muted/40 px-2.5 py-0.5 text-xs transition-colors hover:bg-muted"
                title={`Remove ${chip.label}`}
              >
                {chip.label} ✕
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
          {(
            [
              { key: "result", value: "BLANK", label: "Went blank", count: stats.blank },
              {
                key: "result",
                value: "unattempted",
                label: "Never attempted",
                count: stats.unattempted,
              },
              { key: "result", value: "PARTIAL", label: "Partial", count: stats.partial },
              { key: "result", value: "CONFIDENT", label: "Confident", count: stats.confident },
            ] as const
          ).map((jump) => (
            <Button
              key={jump.label}
              type="button"
              size="xs"
              variant="outline"
              onClick={() => apply({ [jump.key]: jump.value })}
            >
              {jump.label} ({jump.count})
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
