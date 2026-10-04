import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Plus,
  Sparkles,
  Trophy,
  ListOrdered,
} from "lucide-react";
import { requireUserPage } from "@/lib/permissions";
import { prisma } from "@/lib/db/prisma";
import {
  getActiveTopics,
  getBookmarkedTopics,
  getCompletedTopics,
  getQueue,
  getTopicCounts,
} from "@/server/services/dashboard";
import { getLearningPath, getPathTopics } from "@/server/services/paths";
import { getUnlockedAchievements } from "@/server/services/achievements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/primitives";
import {
  DifficultyBadge,
  EmptyState,
  PageHeader,
  StatusBadge,
} from "@/components/ui/feedback";
import { LEARNER_ROLES, TARGET_LEVELS } from "@/config";
import { formatDate, formatDuration, formatRelativeTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "My learning",
  description: "Your queue, active topics, bookmarks, completed work and personalised path.",
};

export default async function LearningPage() {
  const sessionUser = await requireUserPage();

  const account = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { preferredRole: true, targetLevel: true, name: true },
  });

  const role = account?.preferredRole ?? "BALANCED";
  const level = account?.targetLevel ?? "MID";

  const [counts, queue, active, bookmarks, completed, path, pathTopics, achievements, allAchievements] =
    await Promise.all([
      getTopicCounts(sessionUser.id),
      getQueue(sessionUser.id, 20),
      getActiveTopics(sessionUser.id, 12),
      getBookmarkedTopics(sessionUser.id),
      getCompletedTopics(sessionUser.id, 30, 0),
      getLearningPath(sessionUser.id, role, level),
      getPathTopics(sessionUser.id, role, level, 8),
      getUnlockedAchievements(sessionUser.id, 20),
      prisma.achievement.findMany({
        select: { id: true, slug: true, name: true, description: true, icon: true, criteriaJson: true },
        orderBy: { name: "asc" },
      }),
    ]);

  const unlockedIds = new Set(achievements.map((row) => row.achievementId));

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="My learning"
        description="Everything you are working on, plus the path suggested for your target role and level."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/settings#path">Change my path</Link>
          </Button>
        }
      />

      <Tabs defaultValue="path">
        <TabsList>
          <TabsTrigger value="path">Suggested path</TabsTrigger>
          <TabsTrigger value="queue">Queue ({queue.length})</TabsTrigger>
          <TabsTrigger value="active">In progress ({active.length})</TabsTrigger>
          <TabsTrigger value="bookmarks">Bookmarks ({bookmarks.length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({completed.total})</TabsTrigger>
          <TabsTrigger value="achievements" id="achievements">
            Achievements ({achievements.length})
          </TabsTrigger>
        </TabsList>

        {/* ── Suggested path ── */}
        <TabsContent value="path" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="size-4 text-primary" aria-hidden />
                Your path
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Based on{" "}
                <span className="text-foreground">
                  {LEARNER_ROLES.find((r) => r.value === role)?.label ?? "Balanced full stack"}
                </span>{" "}
                targeting{" "}
                <span className="text-foreground">
                  {TARGET_LEVELS.find((l) => l.value === level)?.label ?? "Mid-level"}
                </span>
                . This changes what is suggested first — it never hides anything from the
                roadmap.
              </p>
              {path.focus.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Focus first on: {path.focus.join(", ")}.
                </p>
              )}
              <div className="grid gap-2 sm:grid-cols-4">
                <Stat label="Completed" value={`${counts.completed}`} />
                <Stat label="Practiced" value={`${counts.practiced}`} />
                <Stat label="In progress" value={`${counts.inProgress}`} />
                <Stat
                  label="Overall"
                  value={`${counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0}%`}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Phase priority for your path</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {path.phases.map((phase) => (
                  <li key={phase.id} className="space-y-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: phase.color }}
                          aria-hidden
                        />
                        {phase.order}. {phase.title}
                      </span>
                      <span className="flex items-center gap-2">
                        <Badge
                          variant={
                            phase.priority >= 2
                              ? "success"
                              : phase.priority === 1
                                ? "info"
                                : "outline"
                          }
                        >
                          {phase.reason}
                        </Badge>
                        <span className="text-xs tabular-nums text-muted-foreground">
                          {phase.completed}/{phase.total}
                        </span>
                      </span>
                    </div>
                    <Progress
                      value={phase.percentage}
                      indicatorClassName={phase.priority >= 2 ? "" : "bg-muted-foreground"}
                    />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Topics to prioritise next</CardTitle>
            </CardHeader>
            <CardContent>
              {pathTopics.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="Nothing outstanding on your path"
                  description="You have completed every recommended topic for this path so far."
                />
              ) : (
                <ul className="space-y-1.5">
                  {pathTopics.map((topic) => (
                    <TopicRow
                      key={topic.id}
                      href={`/roadmap/${topic.slug}`}
                      title={topic.title}
                      difficulty={topic.difficulty}
                      context={`${topic.phaseTitle} › ${topic.groupTitle}`}
                      note={topic.reason}
                      meta={`~${formatDuration(topic.estimatedMinutes)}`}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Queue ── */}
        <TabsContent value="queue" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ListOrdered className="size-4 text-primary" aria-hidden />
                Your learning queue
              </CardTitle>
            </CardHeader>
            <CardContent>
              {queue.length === 0 ? (
                <EmptyState
                  icon={ListOrdered}
                  title="Your queue is empty"
                  description="Add topics to build a personal study sequence. Your queue never changes the master roadmap."
                  action={
                    <Button asChild size="sm">
                      <Link href="/roadmap">Browse the roadmap</Link>
                    </Button>
                  }
                />
              ) : (
                <ol className="space-y-1.5">
                  {queue.map((item, index) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                    >
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                        {index + 1}
                      </span>
                      <Link
                        href={`/roadmap/${item.slug}`}
                        className="min-w-0 flex-1"
                      >
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.phaseTitle} › {item.groupTitle}
                        </span>
                      </Link>
                      <StatusBadge status={item.status} />
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Active ── */}
        <TabsContent value="active" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>In progress and needing revision</CardTitle>
            </CardHeader>
            <CardContent>
              {active.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="Nothing in progress"
                  description="Start a topic from the roadmap and it will show up here."
                />
              ) : (
                <ul className="space-y-1.5">
                  {active.map((row) => (
                    <TopicRow
                      key={row.id}
                      href={`/roadmap/${row.topic.slug}`}
                      title={row.topic.title}
                      difficulty={row.topic.difficulty}
                      context={row.topic.group.phase.title}
                      status={row.status}
                      meta={
                        row.lastStudiedAt ? formatRelativeTime(row.lastStudiedAt) : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Bookmarks ── */}
        <TabsContent value="bookmarks" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bookmark className="size-4 text-primary" aria-hidden />
                Bookmarks
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bookmarks.length === 0 ? (
                <EmptyState
                  icon={Bookmark}
                  title="No bookmarks yet"
                  description="Bookmark a topic to keep it here for later."
                />
              ) : (
                <ul className="space-y-1.5">
                  {bookmarks.map((row) => (
                    <TopicRow
                      key={row.id}
                      href={`/roadmap/${row.topic.slug}`}
                      title={row.topic.title}
                      difficulty={row.topic.difficulty}
                      context={row.topic.group.phase.title}
                      status={row.topic.userProgress[0]?.status ?? "NOT_STARTED"}
                      meta={formatRelativeTime(row.createdAt)}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Completed ── */}
        <TabsContent value="completed" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-primary" aria-hidden />
                Completed topics ({completed.total})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {completed.items.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="No completed topics yet"
                  description="Mark a topic as completed and it will be recorded here with its completion date."
                />
              ) : (
                <ul className="space-y-1.5">
                  {completed.items.map((row) => (
                    <TopicRow
                      key={row.id}
                      href={`/roadmap/${row.topic.slug}`}
                      title={row.topic.title}
                      difficulty={row.topic.difficulty}
                      context={row.topic.group.phase.title}
                      status="COMPLETED"
                      meta={
                        row.completedAt
                          ? `Completed ${formatDate(row.completedAt)} · ${formatDuration(row.totalTimeMinutes)} logged`
                          : undefined
                      }
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Achievements ── */}
        <TabsContent value="achievements" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {allAchievements.map((achievement) => {
              const unlocked = unlockedIds.has(achievement.id);
              const unlockedAt = achievements.find((row) => row.achievementId === achievement.id);
              return (
                <Card key={achievement.id} className={unlocked ? "" : "opacity-60"}>
                  <CardContent className="flex items-start gap-3 p-4">
                    <div
                      className={
                        unlocked
                          ? "flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                          : "flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                      }
                      aria-hidden
                    >
                      {unlocked ? <Trophy className="size-4" /> : <Plus className="size-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{achievement.name}</p>
                      <p className="text-xs text-muted-foreground">{achievement.description}</p>
                      {unlocked && unlockedAt && (
                        <p className="mt-1 text-[11px] text-primary">
                          Unlocked {formatDate(unlockedAt.unlockedAt)}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
          {allAchievements.length === 0 && (
            <EmptyState
              icon={Trophy}
              title="No achievements configured"
              description="Run the database seed to load achievement definitions."
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-3 py-2">
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function TopicRow({
  href,
  title,
  difficulty,
  context,
  status,
  meta,
  note,
}: {
  href: string;
  title: string;
  difficulty: string;
  context: string;
  status?: string;
  meta?: string;
  note?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-secondary/40"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">
            {context}
            {note && ` · ${note}`}
            {meta && ` · ${meta}`}
          </p>
        </div>
        <DifficultyBadge difficulty={difficulty} />
        {status && <StatusBadge status={status} />}
        <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}