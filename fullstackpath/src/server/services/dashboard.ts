import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getActiveDayKeys, getRecentActivity, type ActivityRow } from "./activity";
import { calculateStreaks, recentDayKeys, todayKey, dayKeyInTimezone } from "@/lib/utils/time";
import {
  getActiveTopics,
  getBookmarkedTopics,
  getCompletedTopics,
  getCompletionBreakdown,
  getProgressForTopics,
  getRecentlyStudied,
  getRecommendedTopics,
  getTopicCounts,
} from "./progress";
import { startOfDay, endOfDay, subDays } from "date-fns";

export type DashboardStats = {
  totalTopics: number;
  completedTopics: number;
  practicedTopics: number;
  inProgressTopics: number;
  notStartedTopics: number;
  needsRevisionTopics: number;
  completionPercentage: number;
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  totalLearningMinutes: number;
  todayMinutes: number;
  weekMinutes: number;
  weeklyGoalMinutes: number;
  dailyGoalMinutes: number;
  todayGoalPercentage: number;
  weekGoalPercentage: number;
};

export type DailyPoint = {
  date: string;
  label: string;
  minutes: number;
  topicsCompleted: number;
  active: boolean;
};

/**
 * Dashboard figures.
 *
 * Every number here is derived from the caller's own rows. Nothing is sampled,
 * extrapolated or filled in, and empty state is represented honestly as zeros
 * rather than placeholder data.
 */
export async function getDashboardStats(
  userId: string,
  timezone: string,
  goals: { dailyGoalMinutes: number; weeklyGoalMinutes: number },
): Promise<DashboardStats> {
  const [counts, timeTotals, activeDayKeys] = await Promise.all([
    getTopicCounts(userId),
    getTimeTotals(userId),
    getActiveDayKeys(userId, timezone),
  ]);

  const streaks = calculateStreaks(activeDayKeys, todayKey(timezone));

  const today = startOfDay(new Date());
  const weekStart = startOfDay(subDays(new Date(), 6));

  const todayMinutes = await sumStudyMinutes(userId, today);
  const weekMinutes = await sumStudyMinutes(userId, weekStart);

  const notStarted = counts.notStarted;

  return {
    totalTopics: counts.total,
    completedTopics: counts.completed,
    practicedTopics: counts.practiced,
    inProgressTopics: counts.inProgress,
    notStartedTopics: notStarted,
    needsRevisionTopics: counts.needsRevision,
    completionPercentage:
      counts.total > 0 ? Math.round((counts.completed / counts.total) * 100) : 0,
    currentStreak: streaks.current,
    longestStreak: streaks.longest,
    activeDays: streaks.activeDays,
    totalLearningMinutes: timeTotals.total,
    todayMinutes,
    weekMinutes,
    dailyGoalMinutes: goals.dailyGoalMinutes,
    weeklyGoalMinutes: goals.weeklyGoalMinutes,
    todayGoalPercentage:
      goals.dailyGoalMinutes > 0
        ? Math.min(100, Math.round((todayMinutes / goals.dailyGoalMinutes) * 100))
        : 0,
    weekGoalPercentage:
      goals.weeklyGoalMinutes > 0
        ? Math.min(100, Math.round((weekMinutes / goals.weeklyGoalMinutes) * 100))
        : 0,
  };
}

async function getTimeTotals(userId: string) {
  const [aggregate, sessions] = await Promise.all([
    prisma.userTopicProgress.aggregate({
      where: { userId },
      _sum: { totalTimeMinutes: true },
    }),
    prisma.studySession.aggregate({
      where: { userId },
      _sum: { durationMinutes: true },
    }),
  ]);

  // Time can live on the topic progress row, in a study session, or both (a
  // session is folded into the topic when it ends). Take the larger total rather
  // than adding, which would double count.
  const progressTotal = aggregate._sum.totalTimeMinutes ?? 0;
  const sessionTotal = sessions._sum.durationMinutes ?? 0;
  return { total: Math.max(progressTotal, sessionTotal) };
}

async function sumStudyMinutes(userId: string, from: Date) {
  const aggregate = await prisma.studySession.aggregate({
    where: { userId, startedAt: { gte: from } },
    _sum: { durationMinutes: true },
  });
  return aggregate._sum.durationMinutes ?? 0;
}

/** Last 14 days of study minutes and completions, in the learner's timezone. */
export async function getWeeklyActivity(
  userId: string,
  timezone: string,
  days = 14,
): Promise<DailyPoint[]> {
  const keys = recentDayKeys(timezone, days);
  const from = startOfDay(subDays(new Date(), days - 1));

  const [sessions, completions] = await Promise.all([
    prisma.studySession.findMany({
      where: { userId, startedAt: { gte: from } },
      select: { startedAt: true, durationMinutes: true },
    }),
    prisma.userTopicProgress.findMany({
      where: { userId, completedAt: { gte: from } },
      select: { completedAt: true },
    }),
  ]);

  const minutesByDay = new Map<string, number>();
  for (const session of sessions) {
    const key = dayKeyInTimezone(session.startedAt, timezone);
    minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + session.durationMinutes);
  }

  const completionsByDay = new Map<string, number>();
  for (const row of completions) {
    if (!row.completedAt) continue;
    const key = dayKeyInTimezone(row.completedAt, timezone);
    completionsByDay.set(key, (completionsByDay.get(key) ?? 0) + 1);
  }

  return keys.map((date) => ({
    date,
    label: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: timezone,
    }).format(new Date(`${date}T12:00:00Z`)),
    minutes: minutesByDay.get(date) ?? 0,
    topicsCompleted: completionsByDay.get(date) ?? 0,
    active: (minutesByDay.get(date) ?? 0) > 0 || (completionsByDay.get(date) ?? 0) > 0,
  }));
}

/** The user's learning queue, in their own order. */
export async function getQueue(userId: string, limit = 20) {
  const items = await prisma.userQueueItem.findMany({
    where: { userId, topic: { isActive: true } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    take: limit,
    select: {
      id: true,
      sortOrder: true,
      topic: {
        select: {
          id: true,
          slug: true,
          title: true,
          difficulty: true,
          estimatedMinutes: true,
          userProgress: {
            where: { userId },
            select: { status: true },
            take: 1,
          },
          group: { select: { title: true, phase: { select: { title: true, order: true } } } },
        },
      },
    },
  });

  return items.map((item) => ({
    id: item.id,
    topicId: item.topic.id,
    sortOrder: item.sortOrder,
    title: item.topic.title,
    slug: item.topic.slug,
    difficulty: item.topic.difficulty,
    estimatedMinutes: item.topic.estimatedMinutes,
    status: item.topic.userProgress[0]?.status ?? "NOT_STARTED",
    phaseTitle: item.topic.group.phase.title,
    groupTitle: item.topic.group.title,
  }));
}

export type RevisionSummary = {
  dueToday: number;
  overdue: number;
  upcoming: number;
  total: number;
};

export async function getRevisionSummary(userId: string): Promise<RevisionSummary> {
  const now = new Date();
  const tomorrow = endOfDay(new Date());

  const [dueToday, overdue, upcoming, total] = await Promise.all([
    prisma.revision.count({
      where: { userId, nextReviewAt: { gte: startOfDay(now), lte: tomorrow } },
    }),
    prisma.revision.count({
      where: { userId, nextReviewAt: { lt: startOfDay(now) } },
    }),
    prisma.revision.count({
      where: { userId, nextReviewAt: { gt: tomorrow, lte: new Date(now.getTime() + 7 * 86_400_000) } },
    }),
    prisma.revision.count({ where: { userId } }),
  ]);

  return { dueToday, overdue, upcoming, total };
}

export type ProjectSummary = {
  total: number;
  completed: number;
  inProgress: number;
  recent: {
    id: string;
    title: string;
    slug: string;
    status: string;
    repositoryUrl: string | null;
    demoUrl: string | null;
    completedAt: Date | null;
  }[];
};

export async function getProjectSummary(userId: string): Promise<ProjectSummary> {
  const [projects, progress] = await Promise.all([
    prisma.project.findMany({ orderBy: { order: "asc" }, select: { id: true } }),
    prisma.userProjectProgress.findMany({
      where: { userId },
      select: {
        status: true,
        project: {
          select: { id: true, title: true, slug: true, order: true, difficulty: true },
        },
      },
    }),
  ]);

    const completed = progress.filter((row) => row.status === "COMPLETED").length;
  const inProgress = progress.filter((row) => row.status === "IN_PROGRESS").length;

  const recent = [...progress]
    .filter((row) => row.status !== "NOT_STARTED")
    .sort((a, b) => a.project.order - b.project.order)
    .slice(0, 4)
    .map((row) => ({
      id: row.project.id,
      title: row.project.title,
      slug: row.project.slug,
      status: row.status,
      repositoryUrl: null,
      demoUrl: null,
      completedAt: null,
    }));

  return {
    total: projects.length,
    completed,
    inProgress,
    recent,
  };
}

/** Today's plan: due revisions first, then the active queue, then suggestions. */
export async function getTodaysPlan(userId: string, timezone: string, limit = 6) {
  const dayStart = startOfDay(new Date());
  const dayEnd = endOfDay(new Date());

  const dueRevisions = await prisma.revision.findMany({
    where: { userId, nextReviewAt: { lte: dayEnd } },
    orderBy: { nextReviewAt: "asc" },
    take: limit,
    select: {
      id: true,
      nextReviewAt: true,
      topic: {
        select: {
          id: true,
          slug: true,
          title: true,
          difficulty: true,
          estimatedMinutes: true,
        },
      },
    },
  });

  const items: {
    kind: "revision" | "continue" | "next";
    id: string;
    title: string;
    slug: string;
    difficulty: string;
    estimatedMinutes: number;
    reason: string;
    dueAt?: Date;
  }[] = dueRevisions.map((revision) => ({
    kind: "revision",
    id: revision.topic.id,
    title: revision.topic.title,
    slug: revision.topic.slug,
    difficulty: revision.topic.difficulty,
    estimatedMinutes: revision.topic.estimatedMinutes,
    reason:
      revision.nextReviewAt < dayStart ? "Overdue revision" : "Revision due today",
    dueAt: revision.nextReviewAt,
  }));

  if (items.length < limit) {
    const active = await getActiveTopics(userId, limit - items.length);
    for (const row of active) {
      if (items.some((item) => item.id === row.topic.id)) continue;
      items.push({
        kind: "continue",
        id: row.topic.id,
        title: row.topic.title,
        slug: row.topic.slug,
        difficulty: row.topic.difficulty,
        estimatedMinutes: row.topic.estimatedMinutes,
        reason: "Continue where you left off",
      });
    }
  }

  if (items.length < limit) {
    const next = await getRecommendedTopics(userId, limit - items.length);
    for (const topic of next) {
      if (items.some((item) => item.id === topic.id)) continue;
      items.push({
        kind: "next",
        id: topic.id,
        title: topic.title,
        slug: topic.slug,
        difficulty: topic.difficulty,
        estimatedMinutes: topic.estimatedMinutes,
        reason: topic.reason,
      });
    }
  }

  return items.slice(0, limit);
}

export async function getCurrentPhase(userId: string) {
  const breakdown = await getCompletionBreakdown(userId);

  // The current phase is the earliest phase that is neither empty nor finished.
  return (
    breakdown.phases.find((phase) => phase.total > 0 && phase.percentage < 100) ??
    breakdown.phases[breakdown.phases.length - 1] ??
    null
  );
}

/**
 * Re-exports so a page can import one service module for dashboard-shaped data
 * without knowing which file each function physically lives in.
 */
export {
  getRecentActivity,
  getActiveTopics,
  getRecentlyStudied,
  getBookmarkedTopics,
  getRecommendedTopics,
  getCompletionBreakdown,
  getTopicCounts,
  getCompletedTopics,
  getProgressForTopics,
};
export type { ActivityRow };