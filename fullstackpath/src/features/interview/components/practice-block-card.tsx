"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Eye,
  Flame,
  ListChecks,
  MessagesSquare,
  Repeat,
  ScrollText,
  Target,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import { toggleBlockChecklistAction, updateDrillAction } from "@/server/actions/interview-kit";
import type { PracticeBlockRow } from "@/server/services/interview-kit";

export const PRACTICE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  DRILL: Repeat,
  SCENARIO: Wrench,
  RAPIDFIRE: Flame,
  QA: MessagesSquare,
  MACHINE_CODING: Target,
  CHECKLIST: ListChecks,
  REFERENCE: ScrollText,
};

export const PRACTICE_LABELS: Record<string, string> = {
  DRILL: "Drill",
  SCENARIO: "Debugging scenario",
  RAPIDFIRE: "Rapid-fire",
  QA: "Question bank",
  MACHINE_CODING: "Machine coding",
  CHECKLIST: "Readiness checklist",
  REFERENCE: "Reference",
};

type Props = {
  block: PracticeBlockRow;
  phaseTitle: string;
  phaseColor: string;
};

/**
 * One practice block.
 *
 * Scenarios follow the shape an interviewer actually grades: symptom, then
 * investigation, then root cause, then fix, then prevention. Revealing the
 * answer in that order means a candidate can self-test on the diagnosis before
 * seeing the conclusion.
 */
export function PracticeBlockCard({ block, phaseTitle, phaseColor }: Props) {
  const router = useRouter();
  const Icon = PRACTICE_ICONS[block.kind] ?? ScrollText;
  const [revealed, setRevealed] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState(block.status);
  const [checklist, setChecklist] = React.useState<Record<string, boolean>>(block.checklist);
  const [savingItem, setSavingItem] = React.useState<number | null>(null);

  const isScenario = block.kind === "SCENARIO";
  const hasRunbook =
    block.symptoms.length > 0 || block.investigation.length > 0 || block.rootCause.length > 0;

  const doneCount = block.items.reduce(
    (total, _, index) => total + (checklist[String(index)] ? 1 : 0),
    0,
  );

  async function mark(next: "PASSED" | "NEEDS_WORK" | "ATTEMPTED") {
    setPending(next);
    const result = await updateDrillAction({ blockId: block.id, status: next });
    setPending(null);
    if (result.ok) {
      setStatus(next);
      router.refresh();
    }
  }

  /**
   * Optimistic tick: the checkbox responds immediately and rolls back if the
   * write fails, so a slow round trip never makes the card feel broken.
   */
  async function toggleItem(index: number) {
    const key = String(index);
    const next = !checklist[key];
    setSavingItem(index);
    setChecklist((current) => ({ ...current, [key]: next }));
    const result = await toggleBlockChecklistAction({ blockId: block.id, index, done: next });
    setSavingItem(null);
    if (!result.ok) {
      setChecklist((current) => ({ ...current, [key]: !next }));
      return;
    }
    router.refresh();
  }

  return (
    <details className="group rounded-xl border border-border bg-card" open={isScenario}>
      <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
        <div
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${phaseColor}1f`, color: phaseColor }}
          aria-hidden
        >
          <Icon className="size-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-[10px]">
              {PRACTICE_LABELS[block.kind] ?? block.kind}
            </Badge>
            <span className="text-[11px] text-muted-foreground">{phaseTitle}</span>
            {block.afterTopicTitle && (
              <span className="text-[11px] text-muted-foreground/70">
                · after {block.afterTopicTitle}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm font-semibold leading-snug">{block.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {block.items.length > 0
              ? `${block.items.length} item${block.items.length === 1 ? "" : "s"}`
              : hasRunbook
                ? "Runbook"
                : "Reference"}
          </p>
        </div>

        {status === "PASSED" && (
          <Check className="mt-1 size-4 shrink-0 text-green-500" aria-label="Cleared" />
        )}
        {status === "NEEDS_WORK" && (
          <AlertTriangle className="mt-1 size-4 shrink-0 text-orange-500" aria-label="Needs work" />
        )}
        <ChevronDown className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>

      <div className="space-y-4 border-t border-border p-4">
        {block.whyAsked && (
          <section>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Why they ask this
            </h4>
            <p className="text-sm leading-relaxed text-muted-foreground">{block.whyAsked}</p>
          </section>
        )}

        {/* Scenario: symptom first, cause withheld until revealed */}
        {hasRunbook && (
          <section className="space-y-3">
            {block.symptoms.length > 0 && (
              <RunbookList title="What you see" items={block.symptoms} />
            )}

            {!revealed ? (
              <Button variant="outline" size="sm" onClick={() => setRevealed(true)}>
                <Eye />
                {isScenario ? "Reveal the diagnosis" : "Reveal"}
              </Button>
            ) : (
              <>
                {block.investigation.length > 0 && (
                  <RunbookList title="How to investigate" items={block.investigation} />
                )}
                {block.rootCause.length > 0 && (
                  <RunbookList
                    title="Root cause"
                    items={block.rootCause}
                    tone="destructive"
                  />
                )}
                {block.fix.length > 0 && <RunbookList title="Fix" items={block.fix} tone="success" />}
                {block.prevention.length > 0 && (
                  <RunbookList title="Prevention" items={block.prevention} />
                )}
                {block.tools.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-medium text-muted-foreground">Tools</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {block.tools.map((tool) => (
                        <Badge key={tool} variant="outline">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {block.items.length > 0 && (
          <section>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {block.kind === "CHECKLIST" ? "Work through each item" : "Items"}
              </h4>
              {doneCount > 0 && (
                <span className="text-xs tabular-nums text-muted-foreground">
                  {doneCount}/{block.items.length}
                </span>
              )}
            </div>

            {doneCount > 0 && (
              <div
                className="mb-2 h-1 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={block.items.length}
                aria-valuenow={doneCount}
                aria-label="Items ticked"
              >
                <div
                  className="h-full rounded-full bg-primary transition-[width]"
                  style={{ width: `${Math.round((doneCount / block.items.length) * 100)}%` }}
                />
              </div>
            )}

            {block.kind === "CHECKLIST" ? (
              <ul className="space-y-1.5">
                {block.items.map((item, index) => {
                  const key = String(index);
                  const done = checklist[key] === true;
                  return (
                    <li key={`${item}-${index}`}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-sm transition-colors",
                          "hover:bg-muted/50 focus-within:ring-2 focus-within:ring-primary/50",
                          done && "text-muted-foreground",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
                          checked={done}
                          disabled={savingItem === index}
                          onChange={() => void toggleItem(index)}
                        />
                        <span className={cn(done && "line-through decoration-muted-foreground/50")}>
                          <span className="mr-2 text-muted-foreground/60">{index + 1}.</span>
                          {item}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <ol className="space-y-1.5">
                {block.items.map((item, index) => {
                  const key = String(index);
                  const done = checklist[key] === true;
                  return (
                    <li key={`${item}-${index}`} className="flex gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 cursor-pointer accent-primary"
                        checked={done}
                        disabled={savingItem === index}
                        aria-label={`Mark item ${index + 1} done`}
                        onChange={() => void toggleItem(index)}
                      />
                      <span className={cn("text-muted-foreground", done && "line-through")}>{item}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        )}

        {block.sayOutLoud && (
          <section className="rounded-lg border border-primary/25 bg-primary/[0.06] p-3">
            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
              Say out loud
            </h4>
            <p className="text-sm leading-relaxed text-foreground">{block.sayOutLoud}</p>
          </section>
        )}

        {block.evaluation.length > 0 && (
          <section>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              What they evaluate
            </h4>
            <ul className="space-y-1">
              {block.evaluation.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {block.probe.length > 0 && (
          <section>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              They will probe
            </h4>
            <ul className="space-y-1">
              {block.probe.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-orange-500/60" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {block.mistakes.length > 0 && (
          <section>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Watch out for
            </h4>
            <ul className="space-y-1">
              {block.mistakes.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-orange-500" aria-hidden />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        )}

        {block.signal && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Strong answer signals: </span>
            {block.signal}
          </p>
        )}

        {block.markdown && (
          <section className="md-preview rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.markdown}</ReactMarkdown>
          </section>
        )}

        {block.referenceMarkdown && (
          <section>
            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reference material
            </h4>
            <div className="md-preview max-h-96 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{block.referenceMarkdown}</ReactMarkdown>
            </div>
          </section>
        )}

        <Separator />

        <div className="flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={status === "PASSED" ? "subtle" : "outline"}
            loading={pending === "PASSED"}
            onClick={() => mark("PASSED")}
          >
            <Check />
            I can do this
          </Button>
          <Button
            size="sm"
            variant={status === "NEEDS_WORK" ? "subtle" : "outline"}
            loading={pending === "NEEDS_WORK"}
            onClick={() => mark("NEEDS_WORK")}
          >
            <AlertTriangle />
            Needs work
          </Button>
          {status && (
            <Button
              size="sm"
              variant="ghost"
              loading={pending === "ATTEMPTED"}
              onClick={() => mark("ATTEMPTED")}
            >
              <X />
              Reset
            </Button>
          )}
        </div>
      </div>
    </details>
  );
}

function RunbookList({
  title,
  items,
  tone = "default",
}: {
  title: string;
  items: string[];
  tone?: "default" | "destructive" | "success";
}) {
  const toneClass =
    tone === "destructive"
      ? "border-red-500/25 bg-red-500/[0.07]"
      : tone === "success"
        ? "border-green-500/25 bg-green-500/[0.07]"
        : "border-border bg-muted/30";

  return (
    <div className={cn("rounded-lg border p-3", toneClass)}>
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2 text-sm text-foreground">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-current opacity-40" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
