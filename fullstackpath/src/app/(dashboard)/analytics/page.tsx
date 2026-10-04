import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  Award,
  BarChart3,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Flame,
  Target,
  TrendingUp,
} from "lucide-react";
import { requireUserPage } from "@/lib/permissions";
import { prisma } from "@/lib/db/prisma";
import { getActiveDayKeys } from "@/server/services/activity";
import {
  getCompletionBreakdown,
  getTopicCounts,
} from "@/server/services/progress";
import { getWeeklyActivity } from "@/server/services/dashboard";
import { getRevisionActivity } from "@/server/services/revision";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard, EmptyState, PageHeader, ProgressRing } from "@/components/ui/feedback";
import {
  CompletionsOverTimeChart,
  ConsistencyHeatmap,
  CumulativeCompletionsChart,
  DifficultyCompletionChart,
  PhaseCompletionChart,
  StatusDonutChart,
  StreakRadial,
  StudyMinutesChart,
} from "@/components/charts";
import { calculateStreaks, todayKey } from "@/lib/utils/time";
import { formatDuration } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Analytics",
  description: "Learning time, streaks, completion and revision metrics calculated from your own records.",
};

/**
 * Analytics.
 *
 * Calculation rules, stated so the numbers are not mysterious:
 *
 *  - Overall completion   = completed topics / total active topics in the roadmap.
 *  - Learning time        = the greater of (sum of topic progress minutes) and
 *                          (sum of study session minutes). Both are recorded from
 *                          the same sessions, so they are not added together.
 *  - Active day           = a local calendar day with at least one study session,
 *                          topic completion or revision review.
 *  - Current streak       = consecutive active days ending today or yesterday.
 *  - Longest streak       = longest run of consecutive active days ever recorded.
 *  - Phase/difficulty %   = completed topics in that slice / total topics in it.
 *  - Average weekly study = total logged minutes / number of weeks since the first
 *                          activity (counting the current partial week).
 */
export default async function AnalyticsPage() {
  const sessionUser = await requireUserPage();

  const account = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { timezone: true, dailyGoalMinutes: true, weeklyGoalMinutes: true },
  });
  const timezone = account?.timezone ?? "UTC";

  const [counts, breakdown, daily, revisionActivity, activeDayKeys, firstSession, lastSession] =
    await Promise.all([
      getTopicCounts(sessionUser.id),
      getCompletionBreakdown(sessionUser.id),
      getWeeklyActivity(sessionUser.id, timezone, 30),
      getRevisionActivity(sessionUser.id, 30),
      getActiveDayKeys(sessionUser.id, timezone),
      prisma.studySession.findFirst({
        where: { userId: sessionUser.id },
        orderBy: { startedAt: "asc" },
        select: { startedAt: true },
      }),
      prisma.studySession.findFirst({
        where: { userId: sessionUser.id },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      }),
    ]);

  const streaks = calculateStreaks(activeDayKeys, todayKey(timezone));

  const totalMinutes = daily.reduce((sum, point) => sum + point.minutes, 0);
  const sessions = await prisma.studySession.aggregate({
    where: { userId: sessionUser.id },
    _sum: { durationMinutes: true },
    _count: { _all: true },
  });
  const lifetimeMinutes = sessions._sum.durationMinutes ?? 0;

  /**
 * Average weekly study time is measured from the learner's first session to their
 * most recent one, so it is derived entirely from stored records rather than the
 * wall clock (which would change on every re-render and is impure in render).
 */
  const weeks = firstSession && lastSession
    ? Math.max(1, Math.ceil((lastSession.startedAt.getTime() - firstSession.startedAt.getTime()) / (7 * 86_400_000)) + 1)
    : 1;
  const averageWeeklyMinutes = Math.round(lifetimeMinutes / weeks);

  const dailyPoints = daily.map((point) => ({
    ...point,
    label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
      new Date(`${point.date}T12:00:00Z`),
    ),
  }));

  const cumulative: { label: string; cumulative: number }[] = [];
  let running = 0;
  for (const point of dailyPoints) {
    running += point.topicsCompleted;
    cumulative.push({ label: point.label, cumulative: running });
  }

  const completionPercentage =
    counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0;

  const hasAnyActivity = lifetimeMinutes > 0 || counts.started > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Analytics"
        description="Every figure below is computed from your own study sessions, completions and reviews."
      />

      {!hasAnyActivity && (
        <EmptyState
          icon={BarChart3}
          title="No activity to analyse yet"
          description="Start a topic and run the study timer. Charts fill in from your real activity — nothing here is pre-filled with sample data."
          action={
            <Link
              href="/roadmap"
              className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Open the roadmap
            </Link>
          }
        />
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4 p-4">
          <ProgressRing value={completionPercentage} size={64} strokeWidth={6} />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Overall completion</p>
            <p className="truncate text-sm font-medium">
              {counts.completed} / {counts.total} topics
            </p>
          </div>
        </Card>

        <StatCard
          label="Total study time"
          value={formatDuration(lifetimeMinutes)}
          sublabel={`${sessions._count._all ?? 0} sessions recorded`}
          icon={Clock}
          tone="info"
        />
        <StatCard
          label="Current streak"
          value={`${streaks.current} day${streaks.current === 1 ? "" : "s"}`}
          sublabel={`Longest: ${streaks.longest} days`}
          icon={Flame}
          tone="warning"
        />
        <StatCard
          label="Average weekly study"
          value={formatDuration(averageWeeklyMinutes)}
          sublabel={`Across ${weeks} week${weeks === 1 ? "" : "s"} of activity`}
          icon={TrendingUp}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Topics completed" value={counts.completed} icon={CheckCircle2} tone="success" />
        <StatCard label="Topics practiced" value={counts.practiced} icon={Award} />
        <StatCard label="Active days" value={streaks.activeDays} icon={Activity} />
        <StatCard
          label="Daily goal"
          value={
            (account?.dailyGoalMinutes ?? 0) > 0
              ? `${formatDuration(
                  dailyPoints[dailyPoints.length - 1]?.minutes ?? 0,
                )} / ${formatDuration(account?.dailyGoalMinutes ?? 0)}`
              : "Not set"
          }
          sublabel={`Weekly target ${formatDuration(account?.weeklyGoalMinutes ?? 0)}`}
          icon={Target}
          tone="muted"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Daily study time (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {totalMinutes === 0 ? (
              <EmptyState icon={Clock} title="No study time in this window" />
            ) : (
              <StudyMinutesChart data={dailyPoints} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Learning consistency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ConsistencyHeatmap data={dailyPoints.map((p) => ({ date: p.date, minutes: p.minutes, active: p.active }))} />
            <StreakRadial current={streaks.current} longest={streaks.longest} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Topics completed per day</CardTitle>
          </CardHeader>
          <CardContent>
            {counts.completed === 0 ? (
              <EmptyState icon={CheckCircle2} title="No completions yet" />
            ) : (
              <CompletionsOverTimeChart data={dailyPoints} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cumulative completions</CardTitle>
          </CardHeader>
          <CardContent>
            {counts.completed === 0 ? (
              <EmptyState icon={TrendingUp} title="No completions yet" />
            ) : (
              <CumulativeCompletionsChart data={cumulative} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Completion by phase</CardTitle>
          </CardHeader>
          <CardContent>
            <PhaseCompletionChart data={breakdown.phases} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completion by difficulty</CardTitle>
          </CardHeader>
          <CardContent>
            <DifficultyCompletionChart data={breakdown.difficulties} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Topic status breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <StatusDonutChart
              completed={counts.completed}
              practiced={counts.practiced}
              inProgress={counts.inProgress}
              needsRevision={counts.needsRevision}
              notStarted={counts.notStarted}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="size-4 text-primary" aria-hidden />
              Revision activity (last 30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {revisionActivity.every((point) => point.total === 0) ? (
              <EmptyState
                icon={CalendarCheck}
                title="No revision reviews yet"
                description="Add a topic to your revision schedule and review it to see recall rates here."
              />
            ) : (
              <div className="space-y-3">
                <StudyMinutesChart
                  data={revisionActivity.map((point) => ({
                    date: point.date,
                    label: point.label,
                    minutes: point.total * 5,
                    topicsCompleted: point.recalled,
                    active: point.total > 0,
                  }))}
                />
                <p className="text-xs text-muted-foreground">
                  Bars show reviews you rated &ldquo;recalled it&rdquo; or better. Total reviews:{" "}
                  {revisionActivity.reduce((sum, point) => sum + point.total, 0)}.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}