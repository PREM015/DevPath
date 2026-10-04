"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatRelativeTime } from "@/lib/utils";
import { recordAttemptAction } from "@/server/actions/interview-kit";
import type { QuestionRow } from "@/server/services/interview-kit";

type Props = {
  questions: QuestionRow[];
  /** Starts collapsed so a long list stays scannable. */
  defaultOpen?: boolean;
  showPhase?: boolean;
};

const RESULT_META = {
  CONFIDENT: { label: "Confident", className: "status-completed", icon: Check },
  PARTIAL: { label: "Partial", className: "status-practiced", icon: HelpCircle },
  BLANK: { label: "Blank", className: "status-revision", icon: X },
} as const;

/**
 * The question bank.
 *
 * The loop is deliberate and matches how you actually revise: read the question,
 * answer it out loud before looking, reveal the model answer, then be honest with
 * yourself about how it went. The rating is the only thing recorded, and it feeds
 * the "questions you could not answer" gap list.
 */
export function QuestionBank({ questions, defaultOpen = false, showPhase = true }: Props) {
  const router = useRouter();
  const [revealed, setRevealed] = React.useState<Record<string, boolean>>({});
  const [pending, setPending] = React.useState<string | null>(null);

  // A rating the learner just gave takes precedence over the server value, so
  // the badge updates immediately instead of waiting for the refresh to land.
  const [localResults, setLocalResults] = React.useState<Record<string, string>>({});
  const resultFor = (questionId: string, fallback: string | undefined) =>
    localResults[questionId] ?? fallback;

  if (questions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        No questions match these filters.
      </p>
    );
  }

  async function rate(questionId: string, result: "CONFIDENT" | "PARTIAL" | "BLANK") {
    setPending(questionId);
    const outcome = await recordAttemptAction({ questionId, result });
    setPending(null);
    if (outcome.ok) {
      setLocalResults((current) => ({ ...current, [questionId]: result }));
      router.refresh();
    }
  }

  return (
    <ol className="space-y-2">
      {questions.map((question, index) => {
        const isRevealed = revealed[question.id] ?? defaultOpen;
        const result = resultFor(question.id, question.attempt?.result);
        const meta = result ? RESULT_META[result as keyof typeof RESULT_META] : null;
        const ResultIcon = meta?.icon;

        return (
          <li
            key={question.id}
            className={cn(
              "rounded-xl border bg-card p-4 transition-colors",
              result === "BLANK" ? "border-orange-500/30" : "border-border",
            )}
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground">
                {index + 1}.
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="outline" className="text-[10px]">
                    {question.difficulty.toLowerCase()}
                  </Badge>
                  {showPhase && question.phaseTitle && (
                    <span className="text-[11px] text-muted-foreground">
                      {question.phaseTitle}
                    </span>
                  )}
                  {question.attempt && (
                    <span className="text-[11px] text-muted-foreground/70">
                      tried {question.attempt.attempts}× ·{" "}
                      {formatRelativeTime(question.attempt.lastAttemptAt)}
                    </span>
                  )}
                </div>

                <p className="mt-1.5 text-sm font-medium leading-relaxed">{question.text}</p>

                {question.topicSlug && (
                  <a
                    href={`/roadmap/${question.topicSlug}`}
                    className="mt-1 inline-block text-[11px] text-muted-foreground hover:text-primary"
                  >
                    {question.topicTitle}
                  </a>
                )}

                {isRevealed && question.modelAnswer ? (
                  <div className="mt-3 rounded-lg border border-green-500/25 bg-green-500/[0.06] p-3">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                      Model answer
                    </p>
                    <p className="text-sm leading-relaxed text-foreground">
                      {question.modelAnswer}
                    </p>
                  </div>
                ) : isRevealed ? (
                  <p className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    No model answer is written for this one yet. Write your own, then check it
                    against the topic — a question without a rehearsed answer is the most common
                    reason a strong candidate blanks in a real round.
                  </p>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => setRevealed((current) => ({ ...current, [question.id]: true }))}
                  >
                    <Eye />
                    Reveal the answer
                  </Button>
                )}

                {isRevealed && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-muted-foreground">
                      How did you do?
                    </span>
                    {(
                      [
                        { value: "CONFIDENT", label: "Confident", icon: Check },
                        { value: "PARTIAL", label: "Partial", icon: HelpCircle },
                        { value: "BLANK", label: "Blank", icon: X },
                      ] as const
                    ).map((option) => {
                      const Icon = option.icon;
                      const active = result === option.value;
                      return (
                        <Button
                          key={option.value}
                          size="xs"
                          variant={active ? "subtle" : "ghost"}
                          loading={pending === question.id}
                          aria-pressed={active}
                          onClick={() => rate(question.id, option.value)}
                        >
                          <Icon />
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                )}
              </div>

              {meta && ResultIcon && (
                <span
                  className={cn(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                    meta.className,
                  )}
                  title={meta.label}
                >
                  <ResultIcon className="size-3" aria-hidden />
                  <span className="sr-only">{meta.label}</span>
                </span>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
