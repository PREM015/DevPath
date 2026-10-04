"use client";

import * as React from "react";
import { cn, formatDuration } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import {
  BookOpen,
  CheckCircle2,
  CircleDot,
  Flame,
  Layers,
  Lock,
  BookmarkPlus,
  BookmarkCheck,
  CalendarClock,
  ListChecks,
  MessageSquare,
  Clock,
} from "lucide-react";
import type { TopicPanelData } from "./types";
import type { ActionResult } from "@/server/actions/progress";

const STATUS_OPTIONS = [
  { value: "IN_PROGRESS", label: "In progress", icon: CircleDot },
  { value: "PRACTICED", label: "Practiced", icon: ListChecks },
  { value: "COMPLETED", label: "Completed", icon: CheckCircle2 },
  { value: "NEEDS_REVISION", label: "Needs revision", icon: Flame },
] as const;

const DIFFICULTY_CLASSES: Record<string, string> = {
  BEGINNER: "diff-beginner",
  INTERMEDIATE: "diff-intermediate",
  ADVANCED: "diff-advanced",
  SENIOR: "diff-senior",
};

const STATUS_CLASSES: Record<string, string> = {
  NOT_STARTED: "status-not-started",
  IN_PROGRESS: "status-in-progress",
  PRACTICED: "status-practiced",
  COMPLETED: "status-completed",
  NEEDS_REVISION: "status-revision",
  BLOCKED: "status-blocked",
};

/**
 * Topic side panel.
 *
 * Everything the learner can do with a topic happens here without leaving the
 * canvas. Each control calls a server action that re-checks the session, so the
 * panel cannot be used to touch another user's progress.
 */
export function TopicPanel({
  data: initialData,
  onStatusChange,
  onBookmarkChange,
}: {
  data: TopicPanelData;
  onStatusChange: (topicId: string, status: string) => void;
  onBookmarkChange: (topicId: string, bookmarked: boolean) => void;
}) {
  const [data, setData] = React.useState(initialData);
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);

  React.useEffect(() => setData(initialData), [initialData]);

  const blocked =
    data.prerequisitesTotal > 0 && data.prerequisitesMet < data.prerequisitesTotal;

  async function run(
    key: string,
    action: () => Promise<ActionResult>,
    apply?: (result: ActionResult) => void,
  ) {
    setPending(key);
    setMessage(null);
    try {
      const result = await action();
      if (result.ok) {
        setMessage({ kind: "ok", text: result.message });
        apply?.(result);
      } else {
        setMessage({ kind: "error", text: result.error });
      }
    } catch {
      setMessage({ kind: "error", text: "Something went wrong. Please try again." });
    } finally {
      setPending(null);
    }
  }

  async function changeStatus(status: string) {
    const { updateTopicProgress } = await import("@/server/actions/progress");
    await run(
      "status",
      () => updateTopicProgress({ topicId: data.id, status: status as never }),
      () => {
        setData((current) => ({
          ...current,
          status: status as TopicPanelData["status"],
          completedAt: status === "COMPLETED" ? new Date().toISOString() : null,
        }));
        onStatusChange(data.id, status);
      },
    );
  }

  async function toggleBookmark() {
    const { toggleBookmark } = await import("@/server/actions/progress");
    await run("bookmark", () => toggleBookmark(data.id), () => {
      setData((current) => ({ ...current, bookmarked: !current.bookmarked }));
      onBookmarkChange(data.id, !data.bookmarked);
    });
  }

  async function scheduleRevision() {
    const { scheduleRevision } = await import("@/server/actions/progress");
    await run("revision", () => scheduleRevision(data.id), () => {
      setData((current) => ({ ...current, scheduledForRevision: true }));
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b border-border p-5">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge className={DIFFICULTY_CLASSES[data.difficulty]}>
            {data.difficulty === "SENIOR" ? "Senior" : data.difficulty[0] + data.difficulty.slice(1).toLowerCase()}
          </Badge>
          <Badge className={STATUS_CLASSES[data.status]}>
            {data.status.replace(/_/g, " ").toLowerCase()}
          </Badge>
          {data.isArchived && <Badge variant="warning">Archived</Badge>}
        </div>

        <p className="text-xs text-muted-foreground">
          Phase {data.group.phase.order} · {data.group.phase.title} › {data.group.title}
        </p>
        <h2 className="mt-1 text-lg font-semibold leading-snug">{data.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            ~{formatDuration(data.estimatedMinutes)} estimated
          </span>
          {data.totalTimeMinutes > 0 && (
            <span className="flex items-center gap-1 text-primary">
              <Clock className="size-3.5" aria-hidden />
              {formatDuration(data.totalTimeMinutes)} logged
            </span>
          )}
          {data.completedAt && (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-3.5" aria-hidden />
              Completed
            </span>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
        {blocked && (
          <div className="flex items-start gap-2 rounded-lg border border-orange-500/25 bg-orange-500/10 px-3 py-2.5">
            <Lock className="mt-0.5 size-4 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden />
            <div className="text-xs leading-relaxed text-orange-700 dark:text-orange-300">
              <p className="font-medium">
                {data.prerequisitesMet} of {data.prerequisitesTotal} prerequisites completed
              </p>
              <p className="mt-0.5 opacity-90">
                This topic is not blocked — you can study it now. Completing its prerequisites
                first is the recommended order.
              </p>
            </div>
          </div>
        )}

        {data.prerequisitesTotal > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <Layers className="size-3.5" aria-hidden />
              Prerequisites
            </h3>
            <Progress value={(data.prerequisitesMet / data.prerequisitesTotal) * 100} className="mb-2" />
            <p className="text-xs text-muted-foreground">
              {data.prerequisitesMet} of {data.prerequisitesTotal} completed
            </p>
          </section>
        )}

        {data.keyConcepts.length > 0 && (
          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <BookOpen className="size-3.5" aria-hidden />
              Key concepts
            </h3>
            <ul className="space-y-1.5">
              {data.keyConcepts.map((concept) => (
                <li key={concept} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
                  <span>{concept}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <MessageSquare className="size-3.5" aria-hidden />
            Interview angle
          </h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Open the full topic page for resources, practice tasks and the interview question bank.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-2">
            <a href={`/roadmap/${data.slug}`}>Open topic page</a>
          </Button>
        </section>
      </div>

      <div className="shrink-0 space-y-2 border-t border-border bg-card/50 p-4">
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

        <div className="grid grid-cols-2 gap-1.5">
          {STATUS_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = data.status === option.value;
            return (
              <Button
                key={option.value}
                size="sm"
                variant={isActive ? "subtle" : "outline"}
                loading={pending === "status"}
                aria-pressed={isActive}
                onClick={() => changeStatus(option.value)}
              >
                <Icon />
                {option.label}
              </Button>
            );
          })}
        </div>

        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            loading={pending === "bookmark"}
            onClick={toggleBookmark}
          >
            {data.bookmarked ? <BookmarkCheck /> : <BookmarkPlus />}
            {data.bookmarked ? "Bookmarked" : "Bookmark"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            loading={pending === "revision"}
            disabled={data.scheduledForRevision}
            onClick={scheduleRevision}
          >
            <CalendarClock />
            {data.scheduledForRevision ? "Scheduled" : "Revise"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export { STATUS_CLASSES, DIFFICULTY_CLASSES };