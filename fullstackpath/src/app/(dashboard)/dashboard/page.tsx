import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarClock,
  Check,
  Clock,
  Flame,
  HelpCircle,
  ListTodo,
  MessagesSquare,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Bookmark,
  Wrench,
} from "lucide-react";
import { requireUserPage } from "@/lib/permissions";
import { prisma } from "@/lib/db/prisma";
import { getUnlockedAchievements } from "@/server/services/achievements";
import {
  getNextUpQuestions,
  getPracticeStats,
  getQuestionStats,
} from "@/server/services/interview-kit";
import {
  getDashboardStats,
  getWeeklyActivity,
  getTodaysPlan,
  getCurrentPhase,
  getRevisionSummary,
  getProjectSummary,
  getRecentActivity,
  getActiveTopics,
  getRecommendedTopics,
  getCompletionBreakdown,
} from "@/server/services/dashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import {
  EmptyState,
  PageHeader,
  ProgressRing,
  StatCard,
  DifficultyBadge,
} from "@/components/ui/feedback";
import { StudyMinutesChart } from "@/components/charts";
import { cn, formatDuration, formatRelativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
  description:
    "The questions you should answer next, drills due, and your recall — before any roadmap bookkeeping.",
};

export default async function DashboardPage() {
  const sessionUser = await requireUserPage();

  const account = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      name: true,
      timezone: true,
      dailyGoalMinutes: true,
      weeklyGoalMinutes: true,
      preferredRole: true,
      targetLevel: true,
    },
  });

  const timezone = account?.timezone ?? "UTC";

  const [
    stats,
    activity,
    plan,
    currentPhase,
    revisions,
    projects,
    achievements,
    recentActivity,
    activeTopics,
    recommended,
    breakdown,
    nextUp,
    questionStats,
    practiceStats,
  ] = await Promise.all([
    getDashboardStats(sessionUser.id, timezone, {
      dailyGoalMinutes: account?.dailyGoalMinutes ?? 60,
      weeklyGoalMinutes: account?.weeklyGoalMinutes ?? 300,
    }),
    getWeeklyActivity(sessionUser.id, timezone, 14),
    getTodaysPlan(sessionUser.id, timezone, 6),
    getCurrentPhase(sessionUser.id),
    getRevisionSummary(sessionUser.id),
    getProjectSummary(sessionUser.id),
    getUnlockedAchievements(sessionUser.id, 4),
    getRecentActivity(sessionUser.id, 8),
    getActiveTopics(sessionUser.id, 5),
    getRecommendedTopics(sessionUser.id, 5),
    getCompletionBreakdown(sessionUser.id),
    getNextUpQuestions(sessionUser.id, 5),
    getQuestionStats(sessionUser.id),
    getPracticeStats(sessionUser.id),
  ]);

  const firstName = account?.name?.split(" ")[0] ?? "there";

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Start with the questions you got wrong. Everything else on this page is secondary."
      />

      {/* ── Interview first ───────────────────────────────────────
          The recall loop is the product, so it is what the dashboard opens on.
          Roadmap completion is demoted below it because finishing a topic is not
          the same as being able to answer questions about it. */}
      <Card className="border-primary/30">
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2">
            <MessagesSquare className="size-4 text-primary" aria-hidden />
            Answer these next
          </CardTitle>
          <div className="flex gap-1.5">
            <Button asChild size="sm">
              <Link href="/interview/questions?result=blank">Work through them</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/interview">Practice kit</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {nextUp.length === 0 ? (
            <EmptyState
              icon={MessagesSquare}
              title="No questions waiting"
              description="You have rated every available question. Add more content, or revisit the ones you marked confident to check they stuck."
              action={
                <Button asChild size="sm">
                  <Link href="/interview/questions">Open question bank</Link>
                </Button>
              }
            />
          ) : (
            <ol className="space-y-1.5">
              {nextUp.map((question, index) => (
                <li key={question.id}>
                  <Link
                    href="/interview/questions"
                    className="group flex items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-secondary/40"
                  >
                    <span className="mt-0.5 shrink-0 text-xs tabular-nums text-muted-foreground/60">
                      {index + 1}.
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium leading-snug">{question.text}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        {question.phaseTitle && <span>{question.phaseTitle}</span>}
                        {question.attempt && (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            style={
                              question.attempt.result === "BLANK"
                                ? { color: "#dc2626", borderColor: "#dc262655" }
                                : { color: "#d97706", borderColor: "#d9770655" }
                            }
                          >
                            {question.attempt.result === "BLANK" ? "you drew blank" : "partial"}
                          </Badge>
                        )}
                        {!question.attempt && <span>not attempted</span>}
                        {!question.modelAnswer && <span>· no model answer yet</span>}
                      </span>
                    </span>
                    <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                </li>
              ))}
            </ol>
          )}

          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-4">
            <StatCard
              label="Drew blank"
              value={questionStats.blank}
              sublabel={`${questionStats.partial} partial`}
              icon={AlertTriangle}
              tone={questionStats.blank > 0 ? "warning" : "muted"}
            />
            <StatCard
              label="Answered confidently"
              value={questionStats.confident}
              sublabel={`${questionStats.confidenceRate}% of attempted`}
              icon={Check}
              tone="success"
            />
            <StatCard
              label="Never attempted"
              value={questionStats.unattempted}
              sublabel={`of ${questionStats.total} questions`}
              icon={HelpCircle}
              tone="muted"
            />
            <StatCard
              label="Drills cleared"
              value={`${practiceStats.passed}/${practiceStats.total}`}
              sublabel={
                practiceStats.needsWork > 0
                  ? `${practiceStats.needsWork} need work`
                  : `${practiceStats.total} total`
              }
              icon={Wrench}
              tone={practiceStats.needsWork > 0 ? "warning" : "info"}
            />
          </div>
        </CardContent>
      </Card>

      {/* Overview cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4 p-4">
          <ProgressRing value={stats.completionPercentage} size={64} strokeWidth={6} />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Roadmap completion</p>
            <p className="truncate text-sm font-medium">
              {stats.completedTopics} of {stats.totalTopics} topics
            </p>
          </div>
        </Card>

        <StatCard
          label="Current streak"
          value={`${stats.currentStreak}d`}
          sublabel={`Longest: ${stats.longestStreak}d`}
          icon={Flame}
          tone="warning"
        />
        <StatCard
          label="Time studied"
          value={formatDuration(stats.totalLearningMinutes)}
          sublabel={`${formatDuration(stats.weekMinutes)} this week`}
          icon={Clock}
          tone="info"
        />
        <StatCard
          label="Revisions due"
          value={stats.needsRevisionTopics + revisions.dueToday + revisions.overdue}
          sublabel={
            revisions.overdue > 0
              ? `${revisions.overdue} overdue`
              : revisions.dueToday > 0
                ? `${revisions.dueToday} due today`
                : "Nothing due"
          }
          icon={CalendarClock}
          tone={revisions.overdue > 0 ? "warning" : "muted"}
        />
      </div>

      {/* Status breakdown */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="In progress" value={stats.inProgressTopics} icon={TrendingUp} tone="info" />
        <StatCard label="Practiced" value={stats.practicedTopics} icon={ListTodo} />
        <StatCard label="Not started" value={stats.notStartedTopics} tone="muted" />
        <StatCard label="Active days" value={stats.activeDays} icon={Target} tone="success" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Today's plan */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Target className="size-4 text-primary" aria-hidden />
                Today&rsquo;s learning plan
              </CardTitle>
              <Badge variant="outline">
                {formatDuration(stats.todayMinutes)} / {formatDuration(stats.dailyGoalMinutes)}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={stats.todayGoalPercentage} />
              {plan.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="Nothing queued for today"
                  description="Pick a topic from the roadmap and it will appear here with a suggested next step."
                  action={
                    <Button asChild size="sm">
                      <Link href="/roadmap">Open roadmap</Link>
                    </Button>
                  }
                />
              ) : (
                <ul className="space-y-1.5">
                  {plan.map((item) => (
                    <li key={`${item.kind}-${item.id}`}>
                      <Link
                        href={`/roadmap/${item.slug}`}
                        className="group flex items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 transition-colors hover:border-border hover:bg-secondary/40"
                      >
                        <span
                          className={cn(
                            "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                            item.kind === "revision"
                              ? "status-revision"
                              : item.kind === "continue"
                                ? "status-in-progress"
                                : "status-not-started",
                          )}
                        >
                          {item.kind}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {item.reason} · ~{formatDuration(item.estimatedMinutes)}
                          </span>
                        </span>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Weekly activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-4 text-primary" aria-hidden />
                Learning time, last 14 days
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.totalLearningMinutes === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="No study time recorded yet"
                  description="Start the timer on a topic and your daily study time will appear here."
                  action={
                    <Button asChild size="sm">
                      <Link href="/roadmap">Find a topic</Link>
                    </Button>
                  }
                />
              ) : (
                <StudyMinutesChart data={activity} />
              )}
            </CardContent>
          </Card>

          {/* Current phase */}
          {currentPhase && (
            <Card>
              <CardHeader className="flex-row items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <span aria-hidden>🧭</span>
                  Current phase
                </CardTitle>
                <Badge style={{ backgroundColor: `${currentPhase.color}22`, color: currentPhase.color, borderColor: `${currentPhase.color}44` }}>
                  Phase {currentPhase.order}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">{currentPhase.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {currentPhase.completed} of {currentPhase.total} topics complete
                  </p>
                </div>
                <Progress value={currentPhase.percentage} indicatorClassName="bg-primary" />
                <p className="text-xs text-muted-foreground">
                  {currentPhase.percentage}% complete
                </p>
              </CardContent>
            </Card>
          )}

          {/* Phase breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Progress by phase</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {breakdown.phases.map((phase) => (
                  <li key={phase.id} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate font-medium">
                        {phase.order}. {phase.title}
                      </span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {phase.completed}/{phase.total}
                      </span>
                    </div>
                    <Progress value={phase.percentage} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar column */}
        <div className="space-y-5">
          {/* Daily goal */}
          <Card>
            <CardHeader>
              <CardTitle>Daily goal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Today</span>
                <span className="font-medium tabular-nums">
                  {formatDuration(stats.todayMinutes)} / {formatDuration(stats.dailyGoalMinutes)}
                </span>
              </div>
              <Progress value={stats.todayGoalPercentage} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">This week</span>
                <span className="font-medium tabular-nums">
                  {formatDuration(stats.weekMinutes)} / {formatDuration(stats.weeklyGoalMinutes)}
                </span>
              </div>
              <Progress value={stats.weekGoalPercentage} indicatorClassName="bg-cyan-500" />
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link href="/settings#goals">Adjust your goals</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Continue learning */}
          <Card>
            <CardHeader>
              <CardTitle>Continue learning</CardTitle>
            </CardHeader>
            <CardContent>
              {activeTopics.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  You have nothing in progress. Start a topic to see it here.
                </p>
              ) : (
                <ul className="space-y-1">
                  {activeTopics.map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`/roadmap/${row.topic.slug}`}
                        className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-secondary"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm">{row.topic.title}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">
                            {row.topic.group.phase.title}
                          </span>
                        </span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {row.lastStudiedAt ? formatRelativeTime(row.lastStudiedAt) : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Revisions */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle>Revisions</CardTitle>
              <Button asChild variant="ghost" size="xs">
                <Link href="/revision">Open</Link>
              </Button>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/60 py-2">
                  <p className="text-lg font-semibold tabular-nums">{revisions.overdue}</p>
                  <p className="text-[10px] text-muted-foreground">Overdue</p>
                </div>
                <div className="rounded-lg bg-muted/60 py-2">
                  <p className="text-lg font-semibold tabular-nums">{revisions.dueToday}</p>
                  <p className="text-[10px] text-muted-foreground">Today</p>
                </div>
                <div className="rounded-lg bg-muted/60 py-2">
                  <p className="text-lg font-semibold tabular-nums">{revisions.upcoming}</p>
                  <p className="text-[10px] text-muted-foreground">Week</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Projects */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle>Project milestones</CardTitle>
              <Button asChild variant="ghost" size="xs">
                <Link href="/projects">Open</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              <Progress value={projects.total > 0 ? (projects.completed / projects.total) * 100 : 0} />
              <p className="text-xs text-muted-foreground">
                {projects.completed} of {projects.total} projects completed
                {projects.inProgress > 0 && ` · ${projects.inProgress} in progress`}
              </p>
            </CardContent>
          </Card>

          {/* Achievements */}
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="size-4 text-primary" aria-hidden />
                Achievements
              </CardTitle>
              <Button asChild variant="ghost" size="xs">
                <Link href="/learning#achievements">All</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {achievements.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Complete your first topic to unlock an achievement.
                </p>
              ) : (
                <ul className="space-y-2">
                  {achievements.map((row) => (
                    <li key={row.id} className="flex items-start gap-2">
                      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{row.achievement.name}</span>
                        <span className="block text-[11px] text-muted-foreground">
                          {row.achievement.description}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recent activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <p className="text-xs text-muted-foreground">Your activity will appear here.</p>
              ) : (
                <ul className="space-y-2.5">
                  {recentActivity.map((row) => (
                    <li key={row.id} className="flex items-start gap-2 text-xs">
                      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-primary/50" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-muted-foreground">
                          {describeActivity(row.activityType)}
                          {row.topicTitle && (
                            <>
                              {" · "}
                              {row.topicSlug ? (
                                <Link href={`/roadmap/${row.topicSlug}`} className="text-primary hover:underline">
                                  {row.topicTitle}
                                </Link>
                              ) : (
                                row.topicTitle
                              )}
                            </>
                          )}
                        </span>
                        <span className="block text-[11px] text-muted-foreground/70">
                          {formatRelativeTime(row.createdAt)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Recommended */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bookmark className="size-4 text-primary" aria-hidden />
                Recommended next
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {recommended.map((topic) => (
                  <li key={topic.id}>
                    <Link
                      href={`/roadmap/${topic.slug}`}
                      className="block rounded-lg px-2 py-2 transition-colors hover:bg-secondary"
                    >
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm">{topic.title}</span>
                        <DifficultyBadge difficulty={topic.difficulty} />
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {topic.reason}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function describeActivity(type: string): string {
  const labels: Record<string, string> = {
    TOPIC_STARTED: "Started",
    TOPIC_COMPLETED: "Completed",
    TOPIC_PRACTICED: "Practiced",
    TOPIC_REVISED: "Revised",
    TOPIC_RESET: "Reset",
    NOTE_CREATED: "Wrote a note",
    NOTE_UPDATED: "Updated a note",
    BOOKMARK_ADDED: "Bookmarked",
    BOOKMARK_REMOVED: "Removed bookmark",
    PROJECT_STARTED: "Started project",
    PROJECT_COMPLETED: "Completed project",
    ACHIEVEMENT_UNLOCKED: "Unlocked achievement",
    STUDY_SESSION: "Study session",
    PHASE_COMPLETED: "Completed phase",
    MOCK_INTERVIEW_LOGGED: "Logged mock interview",
  };
  return labels[type] ?? "Activity";
}