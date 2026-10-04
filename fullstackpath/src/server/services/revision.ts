import "server-only";

import { prisma } from "@/lib/db/prisma";
import { addDays, endOfDay, startOfDay } from "date-fns";

export type RevisionBucket = "overdue" | "today" | "week" | "later";

export type RevisionRow = {
  id: string;
  topicId: string;
  slug: string;
  title: string;
  difficulty: string;
  estimatedMinutes: number;
  status: string;
  nextReviewAt: Date;
  intervalDays: number;
  ladderIndex: number;
  reviewCount: number;
  easeFactor: number;
  lastReviewedAt: Date | null;
  bucket: RevisionBucket;
};

export type RevisionDashboard = {
  overdue: RevisionRow[];
  today: RevisionRow[];
  week: RevisionRow[];
  later: RevisionRow[];
  total: number;
  reviewsCompleted: number;
  averageEaseFactor: number;
};

function bucketFor(date: Date, now: Date): RevisionBucket {
  if (date < startOfDay(now)) return "overdue";
  if (date <= endOfDay(now)) return "today";
  if (date <= addDays(startOfDay(now), 7)) return "week";
  return "later";
}

/**
 * Revision queue.
 *
 * Buckets are computed from `nextReviewAt` relative to the learner's local day,
 * so "today" means today where the learner is, not in UTC.
 */
export async function getRevisionDashboard(
  userId: string,
  options: { limit?: number } = {},
): Promise<RevisionDashboard> {
  const now = new Date();
  const limit = options.limit ?? 200;

  const [rows, reviewsCompleted, aggregate] = await Promise.all([
    prisma.revision.findMany({
      where: { userId, topic: { isActive: true } },
      orderBy: { nextReviewAt: "asc" },
      take: limit,
      select: {
        id: true,
        topicId: true,
        nextReviewAt: true,
        intervalDays: true,
        ladderIndex: true,
        reviewCount: true,
        easeFactor: true,
        lastReviewedAt: true,
        status: true,
        topic: {
          select: {
            slug: true,
            title: true,
            difficulty: true,
            estimatedMinutes: true,
            group: { select: { phase: { select: { title: true, order: true } } } },
          },
        },
      },
    }),
    prisma.revisionHistory.count({ where: { userId } }),
    prisma.revision.aggregate({
      where: { userId },
      _avg: { easeFactor: true },
    }),
  ]);

  const dashboard: RevisionDashboard = {
    overdue: [],
    today: [],
    week: [],
    later: [],
    total: rows.length,
    reviewsCompleted,
    averageEaseFactor: aggregate._avg.easeFactor ?? 0,
  };

  for (const row of rows) {
    const bucket = bucketFor(row.nextReviewAt, now);
    dashboard[bucket].push({
      id: row.id,
      topicId: row.topicId,
      slug: row.topic.slug,
      title: row.topic.title,
      difficulty: row.topic.difficulty,
      estimatedMinutes: row.topic.estimatedMinutes,
      status: row.status,
      nextReviewAt: row.nextReviewAt,
      intervalDays: row.intervalDays,
      ladderIndex: row.ladderIndex,
      reviewCount: row.reviewCount,
      easeFactor: row.easeFactor,
      lastReviewedAt: row.lastReviewedAt,
      bucket,
    });
  }

  return dashboard;
}

export async function getRevisionHistory(userId: string, limit = 25) {
  return prisma.revisionHistory.findMany({
    where: { userId },
    orderBy: { reviewedAt: "desc" },
    take: limit,
    select: {
      id: true,
      result: true,
      reviewedAt: true,
      previousInterval: true,
      nextInterval: true,
      timeSpentSeconds: true,
      topic: { select: { slug: true, title: true } },
    },
  });
}

/** Reviews completed per day for the last 30 days, for the revision chart. */
export async function getRevisionActivity(userId: string, days = 30) {
  const since = new Date(Date.now() - days * 86_400_000);

  const history = await prisma.revisionHistory.findMany({
    where: { userId, reviewedAt: { gte: since } },
    select: { reviewedAt: true, result: true },
  });

  const byDay = new Map<string, { total: number; recalled: number }>();
  for (let i = days - 1; i >= 0; i -= 1) {
    const key = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    byDay.set(key, { total: 0, recalled: 0 });
  }

  for (const row of history) {
    const key = row.reviewedAt.toISOString().slice(0, 10);
    const entry = byDay.get(key) ?? { total: 0, recalled: 0 };
    entry.total += 1;
    if (row.result === "GOOD" || row.result === "EASY") entry.recalled += 1;
    byDay.set(key, entry);
  }

  return Array.from(byDay.entries()).map(([date, value]) => ({
    date,
    label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
      new Date(`${date}T12:00:00Z`),
    ),
    total: value.total,
    recalled: value.recalled,
  }));
}

/** The learner's configured interval ladder, falling back to the default. */
export async function getRevisionSettings(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { revisionIntervalsJson: true, revisionReminders: true },
  });

  const custom = user?.revisionIntervalsJson as number[] | null | undefined;
  const intervals = Array.isArray(custom) && custom.length > 0 ? custom : null;

  return { intervals, revisionReminders: user?.revisionReminders ?? true };
}