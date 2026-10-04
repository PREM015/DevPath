"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Flame, Brain, Clock, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type ReviewRow = {
  id: string;
  topicId: string;
  slug: string;
  title: string;
  difficulty: string;
  estimatedMinutes: number;
  nextReviewAt: string;
  intervalDays: number;
  reviewCount: number;
};

const RATINGS = [
  { value: "FORGOT", label: "Forgot it", hint: "Back to the start of the ladder", tone: "danger" },
  { value: "HARD", label: "Barely recalled", hint: "Step back one interval", tone: "warning" },
  { value: "GOOD", label: "Recalled it", hint: "Advance one interval", tone: "info" },
  { value: "EASY", label: "Instant recall", hint: "Advance two intervals", tone: "success" },
] as const;

/**
 * One review card.
 *
 * The learner rates their own recall; that rating is the only input to the
 * schedule. Reviewing a topic never marks it complete — completion is a separate,
 * explicit action on the topic page.
 */
export function ReviewCard({ row }: { row: ReviewRow }) {
  const router = useRouter();
  const [revealed, setRevealed] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);

  async function rate(result: (typeof RATINGS)[number]["value"]) {
    setPending(result);
    setMessage(null);
    try {
      const { reviewTopic } = await import("@/server/actions/progress");
      const action = await reviewTopic(row.topicId, result);
      setMessage(action.ok ? action.message : action.error);
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Badge variant="outline">{row.difficulty.toLowerCase()}</Badge>
        <Badge variant="outline">~{row.estimatedMinutes} min</Badge>
        <Badge variant="outline">
          <Clock className="size-3" aria-hidden />
          review {row.reviewCount + 1}
        </Badge>
      </div>

      <h3 className="text-base font-semibold">{row.title}</h3>

      {!revealed ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            Try to explain this topic from memory before revealing your notes.
          </p>
          <Button variant="outline" onClick={() => setRevealed(true)}>
            <Brain />
            I have recalled it (or not)
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <a
            href={`/roadmap/${row.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            Open the topic to check your recall
          </a>

          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">
              How well did you recall it?
            </legend>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {RATINGS.map((rating) => (
                <Button
                  key={rating.value}
                  variant="outline"
                  loading={pending === rating.value}
                  onClick={() => rate(rating.value)}
                  aria-label={`${rating.label}. ${rating.hint}`}
                  className={cn(
                    "h-auto flex-col items-start gap-0.5 py-2",
                    rating.tone === "success" && "hover:border-green-500/50",
                    rating.tone === "danger" && "hover:border-red-500/50",
                  )}
                >
                  <span className="flex items-center gap-1.5 text-sm">
                    {rating.tone === "danger" && <Flame className="size-3.5 text-orange-500" aria-hidden />}
                    {rating.label}
                  </span>
                  <span className="text-[11px] font-normal text-muted-foreground">
                    {rating.hint}
                  </span>
                </Button>
              ))}
            </div>
          </fieldset>

          {message && (
            <p role="status" className="flex items-center gap-1.5 text-xs text-primary">
              <CheckCircle2 className="size-3.5" aria-hidden />
              {message}
            </p>
          )}
        </div>
      )}
    </div>
  );
}