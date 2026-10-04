"use client";

import * as React from "react";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

export type TopicQuestion = { text: string; answer: string; derived?: boolean };

/**
 * Interview questions for a topic.
 *
 * Placed above the explanatory content on purpose: the reason a candidate opens
 * a topic during preparation is that the question will be asked, not that they
 * want a tutorial. The model answer is hidden so the answer gets rehearsed
 * rather than recognised.
 */
export function TopicQuestions({ questions }: { questions: TopicQuestion[] }) {
  const [revealed, setRevealed] = React.useState<Record<string, boolean>>({});

  if (questions.length === 0) return null;

  return (
    <ol className="space-y-2.5">
      {questions.map((question, index) => {
        const isRevealed = revealed[index] ?? false;

        return (
          <li
            key={`${question.text}-${index}`}
            className="rounded-xl border border-border bg-card p-4"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground">
                Q{index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-relaxed">{question.text}</p>

                {question.derived && (
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    Generated from this topic&apos;s concepts — the source does not list it as a
                    question, so treat the answer as something you write yourself.
                  </p>
                )}

                {isRevealed ? (
                  question.answer ? (
                    <div className="mt-3 rounded-lg border border-green-500/25 bg-green-500/[0.06] p-3">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
                        Model answer
                      </p>
                      <p className="text-sm leading-relaxed text-foreground">
                        {question.answer}
                      </p>
                    </div>
                  ) : (
                    <p className="mt-3 rounded-lg border border-dashed border-border bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                      No model answer is written for this one. Write your answer here, then check it
                      against the concepts below — being able to state it out loud is the thing
                      that matters.
                    </p>
                  )
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() =>
                      setRevealed((current) => ({ ...current, [index]: true }))
                    }
                  >
                    <Eye />
                    Reveal the answer
                  </Button>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
