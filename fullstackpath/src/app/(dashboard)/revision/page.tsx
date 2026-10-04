import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Flame, History, Repeat, Settings2, Sparkles } from "lucide-react";
import { requireUserPage } from "@/lib/permissions";
import { DEFAULT_REVISION_INTERVALS } from "@/config";
import {
  getRevisionDashboard,
  getRevisionHistory,
  getRevisionSettings,
} from "@/server/services/revision";
import { ReviewCard } from "@/features/revision/components/review-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import { EmptyState, PageHeader, StatCard } from "@/components/ui/feedback";
import { formatDate, formatRelativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Revision",
  description: "Spaced repetition queue with a configurable review ladder.",
};

const RESULT_LABELS: Record<string, string> = {
  FORGOT: "Forgot it",
  HARD: "Barely recalled",
  GOOD: "Recalled it",
  EASY: "Instant recall",
};

export default async function RevisionPage() {
  const sessionUser = await requireUserPage();

  const [dashboard, history, settings] = await Promise.all([
    getRevisionDashboard(sessionUser.id),
    getRevisionHistory(sessionUser.id, 20),
    getRevisionSettings(sessionUser.id),
  ]);

  const ladder = settings.intervals ?? [...DEFAULT_REVISION_INTERVALS];
  const dueNow = [...dashboard.overdue, ...dashboard.today];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Revision"
        description="Reviews are scheduled on a ladder of intervals. You rate your own recall; that rating decides when the topic comes back."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/settings#revision">Edit intervals</Link>
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Due now"
          value={dueNow.length}
          sublabel={dashboard.overdue.length > 0 ? `${dashboard.overdue.length} overdue` : "Nothing overdue"}
          icon={Flame}
          tone={dashboard.overdue.length > 0 ? "warning" : "muted"}
        />
        <StatCard label="This week" value={dashboard.week.length} icon={CalendarClock} tone="info" />
        <StatCard label="Later" value={dashboard.later.length} icon={Repeat} />
        <StatCard
          label="Reviews completed"
          value={dashboard.reviewsCompleted}
          sublabel={
            dashboard.averageEaseFactor > 0
              ? `Average ease ${dashboard.averageEaseFactor.toFixed(2)}`
              : undefined
          }
          icon={Sparkles}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="size-4 text-primary" aria-hidden />
            Your review ladder
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {ladder.map((days) => `${days}d`).join(" → ")} → repeat at the final step.
          </p>
          <p className="text-xs text-muted-foreground">
            A &ldquo;recalled it&rdquo; rating advances one step, &ldquo;instant recall&rdquo; advances
            two, &ldquo;barely recalled&rdquo; steps back one and &ldquo;forgot it&rdquo; restarts the
            ladder. Reviewing a topic never marks it as completed.
            {settings.intervals === null && " This is the default ladder; you can change it in settings."}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="due">
        <TabsList>
          <TabsTrigger value="due">Due now ({dueNow.length})</TabsTrigger>
          <TabsTrigger value="week">This week ({dashboard.week.length})</TabsTrigger>
          <TabsTrigger value="later">Later ({dashboard.later.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="due" className="mt-4">
          {dueNow.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="Nothing due right now"
              description="Add a topic to your revision schedule from its roadmap page or detail panel."
              action={
                <Button asChild size="sm">
                  <Link href="/roadmap">Browse the roadmap</Link>
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {dueNow.map((row) => (
                <ReviewCard
                  key={row.id}
                  row={{
                    id: row.id,
                    topicId: row.topicId,
                    slug: row.slug,
                    title: row.title,
                    difficulty: row.difficulty,
                    estimatedMinutes: row.estimatedMinutes,
                    nextReviewAt: row.nextReviewAt.toISOString(),
                    intervalDays: row.intervalDays,
                    reviewCount: row.reviewCount,
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          {dashboard.week.length === 0 ? (
            <EmptyState icon={CalendarClock} title="Nothing scheduled this week" />
          ) : (
            <ul className="space-y-1.5">
              {dashboard.week.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/roadmap/${row.slug}`}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-secondary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Due {formatDate(row.nextReviewAt)} · {row.intervalDays}d interval ·{" "}
                        {row.reviewCount} reviews so far
                      </p>
                    </div>
                    <Badge variant="outline">{row.difficulty.toLowerCase()}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="later" className="mt-4">
          {dashboard.later.length === 0 ? (
            <EmptyState icon={Repeat} title="Nothing scheduled further out" />
          ) : (
            <ul className="space-y-1.5">
              {dashboard.later.map((row) => (
                <li key={row.id}>
                  <Link
                    href={`/roadmap/${row.slug}`}
                    className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-secondary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{row.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        Due {formatDate(row.nextReviewAt)}
                      </p>
                    </div>
                    <Badge variant="outline">{row.difficulty.toLowerCase()}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="size-4 text-primary" aria-hidden />
                Review history
              </CardTitle>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <EmptyState icon={History} title="No reviews recorded yet" />
              ) : (
                <ul className="divide-y divide-border">
                  {history.map((row) => (
                    <li key={row.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/roadmap/${row.topic.slug}`}
                          className="truncate text-sm font-medium hover:text-primary hover:underline"
                        >
                          {row.topic.title}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {formatRelativeTime(row.reviewedAt)} · {row.previousInterval}d →{" "}
                          {row.nextInterval}d
                        </p>
                      </div>
                      <Badge
                        variant={
                          row.result === "EASY" || row.result === "GOOD"
                            ? "success"
                            : row.result === "HARD"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {RESULT_LABELS[row.result] ?? row.result}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}