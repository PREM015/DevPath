"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  CheckCircle2,
  ListChecks,
  Flame,
  RotateCcw,
  BookmarkPlus,
  BookmarkCheck,
  CalendarClock,
  Timer,
  Square,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Status = "NOT_STARTED" | "IN_PROGRESS" | "PRACTICED" | "COMPLETED" | "NEEDS_REVISION";

const OPTIONS: { value: Status; label: string; icon: typeof Play }[] = [
  { value: "IN_PROGRESS", label: "Start learning", icon: Play },
  { value: "PRACTICED", label: "Mark as practiced", icon: ListChecks },
  { value: "COMPLETED", label: "Mark as completed", icon: CheckCircle2 },
  { value: "NEEDS_REVISION", label: "Needs revision", icon: Flame },
];

export type ProgressControlsProps = {
  topicId: string;
  slug: string;
  initialStatus: Status;
  initialCompletedAt: string | null;
  initialBookmarked: boolean;
  initialScheduled: boolean;
  initialMinutes: number;
  blocked: boolean;
};

/**
 * Progress controls for a topic page.
 *
 * Completion is always an explicit click — opening this page or starting a timer
 * never marks a topic complete. Completion is reversible via reset.
 */
export function ProgressControls({
  topicId,
  initialStatus,
  initialCompletedAt,
  initialBookmarked,
  initialScheduled,
  initialMinutes,
  blocked,
}: ProgressControlsProps) {
  const router = useRouter();
  const [status, setStatus] = React.useState<Status>(initialStatus);
  const [completedAt, setCompletedAt] = React.useState<string | null>(initialCompletedAt);
  const [bookmarked, setBookmarked] = React.useState(initialBookmarked);
  const [scheduled, setScheduled] = React.useState(initialScheduled);
  const [minutes, setMinutes] = React.useState(initialMinutes);
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);

  // Timer state lives here so the elapsed time is visible while studying.
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    if (!sessionId) return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [sessionId]);

  async function run(
    key: string,
    action: () => Promise<{ ok: boolean; message?: string; error?: string }>,
  ): Promise<{ ok: boolean; message?: string; error?: string }> {
    setPending(key);
    setMessage(null);
    try {
      const result = await action();
      if (result.ok) {
        setMessage({ kind: "ok", text: result.message ?? "Saved." });
        router.refresh();
      } else {
        setMessage({ kind: "error", text: result.error ?? "Something went wrong." });
      }
      return result;
    } catch {
      const fallback = { ok: false, error: "Something went wrong. Please try again." };
      setMessage({ kind: "error", text: fallback.error });
      return fallback;
    } finally {
      setPending(null);
    }
  }

  async function changeStatus(next: Status) {
    const { updateTopicProgress } = await import("@/server/actions/progress");
    const result = await run(`status-${next}`, () =>
      updateTopicProgress({ topicId, status: next }),
    );
    if (result.ok) {
      setStatus(next);
      setCompletedAt(next === "COMPLETED" ? new Date().toISOString() : null);
    }
  }

  async function reset() {
    const { resetTopicProgress } = await import("@/server/actions/progress");
    const result = await run("reset", () => resetTopicProgress(topicId));
    if (result.ok) {
      setStatus("NOT_STARTED");
      setCompletedAt(null);
      setMinutes(0);
    }
  }

  async function toggleBookmark() {
    const { toggleBookmark } = await import("@/server/actions/progress");
    const result = await run("bookmark", () => toggleBookmark(topicId));
    if (result.ok) setBookmarked((value) => !value);
  }

  async function schedule() {
    const { scheduleRevision } = await import("@/server/actions/progress");
    const result = await run("revision", () => scheduleRevision(topicId));
    if (result.ok) setScheduled(true);
  }

  async function toggleTimer() {
    if (sessionId) {
      const { endStudySession } = await import("@/server/actions/progress");
      const spent = Math.max(1, Math.round(elapsed / 60));
      const result = await run("timer", () => endStudySession(sessionId, spent));
      if (result.ok) {
        setMinutes((value) => value + spent);
        setSessionId(null);
        setElapsed(0);
      }
      return;
    }

    const { startStudySession } = await import("@/server/actions/progress");
    setPending("timer");
    try {
      const result = await startStudySession(topicId);
      if (result.ok && result.data?.sessionId) {
        setSessionId(String(result.data.sessionId));
        setMessage({ kind: "ok", text: "Timer started. Time is saved when you stop." });
      } else {
        setMessage({ kind: "error", text: "Could not start the timer." });
      }
    } finally {
      setPending(null);
    }
  }

  const timerLabel =
    elapsed > 0
      ? `${String(Math.floor(elapsed / 60)).padStart(2, "0")}:${String(elapsed % 60).padStart(2, "0")}`
      : "00:00";

  return (
    <div className="space-y-3">
      {blocked && (
        <p className="rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
          Prerequisites are not finished. You can still study this topic now — completing them
          first is the recommended order.
        </p>
      )}

      <div className="grid gap-1.5 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const isActive = status === option.value;
          return (
            <Button
              key={option.value}
              variant={isActive ? "subtle" : "outline"}
              size="sm"
              aria-pressed={isActive}
              loading={pending === `status-${option.value}`}
              onClick={() => void changeStatus(option.value)}
              className="justify-start"
            >
              <Icon />
              {option.label}
            </Button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Button
          variant="outline"
          size="sm"
          loading={pending === "timer"}
          onClick={toggleTimer}
          className={cn(sessionId && "border-green-500/40 text-green-600 dark:text-green-400")}
        >
          {sessionId ? <Square /> : <Timer />}
          {sessionId ? `Stop ${timerLabel}` : "Start timer"}
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleBookmark} loading={pending === "bookmark"}>
          {bookmarked ? <BookmarkCheck /> : <BookmarkPlus />}
          {bookmarked ? "Bookmarked" : "Bookmark"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={schedule}
          loading={pending === "revision"}
          disabled={scheduled}
        >
          <CalendarClock />
          {scheduled ? "Revision scheduled" : "Add to revision"}
        </Button>
        {status !== "NOT_STARTED" && (
          <Button variant="ghost" size="sm" onClick={reset} loading={pending === "reset"}>
            <RotateCcw />
            Reset
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant={status === "COMPLETED" ? "success" : "outline"}>
          {status.replace(/_/g, " ").toLowerCase()}
        </Badge>
        {completedAt && (
          <span>
            Completed{" "}
            {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
              new Date(completedAt),
            )}
          </span>
        )}
        {minutes > 0 && <span>· {minutes} min logged</span>}
      </div>

      {message && (
        <p
          role="status"
          className={cn(
            "text-xs",
            message.kind === "ok" ? "text-green-600 dark:text-green-400" : "text-destructive",
          )}
        >
          {message.text}
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        Opening this page does not change your progress. Status changes only happen when you click
        one of the buttons above.
      </p>
    </div>
  );
}