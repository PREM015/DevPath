import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { Prisma, ProgressStatus } from "@/generated/prisma/client";

/**
 * All reads in this module take the caller's user id explicitly and always
 * filter on it. There is no query here that can return another user's rows
 * unless the caller passes another user's id, and that id only ever comes from
 * the server-side session (see requireUser in lib/permissions).
 */

export type UserProgressSnapshot = {
  /** Map of topicId -> status. Topics with no row are absent (= NOT_STARTED). */
  statusByTopic: Map<string, ProgressStatus>;
  completedTopicIds: Set<string>;
  totalTimeMinutes: number;
};

/**
 * Loads the signed-in user's progress for a set of topics in one query.
 *
 * Fetching only the requested topic ids keeps the roadmap canvas query
 * proportional to what is rendered, rather than to the size of the roadmap.
 */
export async function getProgressForTopics(
  userId: string,
  topicIds: string[],
): Promise<UserProgressSnapshot> {
  if (topicIds.length === 0) {
    return {
      statusByTopic: new Map(),
      completedTopicIds: new Set(),
      totalTimeMinutes: 0,
    };
  }

  const rows = await prisma.userTopicProgress.findMany({
    where: { userId, topicId: { in: topicIds } },
    select: { topicId: true, status: true, totalTimeMinutes: true },
  });

  const statusByTopic = new Map<string, ProgressStatus>();
  const completedTopicIds = new Set<string>();
  let totalTimeMinutes = 0;

  for (const row of rows) {
    statusByTopic.set(row.topicId, row.status);
    totalTimeMinutes += row.totalTimeMinutes;
    if (row.status === "COMPLETED") completedTopicIds.add(row.topicId);
  }

  return { statusByTopic, completedTopicIds, totalTimeMinutes };
}

export type TopicCounts = {
  total: number;
  completed: number;
  practiced: number;
  inProgress: number;
  needsRevision: number;
  started: number;
  notStarted: number;
};

/**
 * Roadmap-wide counts for one user.
 *
 * The denominator is always the number of active topics in the master roadmap,
 * so archived topics stop counting toward completion without deleting the
 * user's historical progress.
 */
export async function getTopicCounts(userId: string): Promise<TopicCounts> {
  const [total, grouped] = await Promise.all([
    prisma.topic.count({ where: { isActive: true } }),
    prisma.userTopicProgress.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
  ]);

  const counts: TopicCounts = {
    total,
    completed: 0,
    practiced: 0,
    inProgress: 0,
    needsRevision: 0,
    started: 0,
    notStarted: 0,
  };

  for (const row of grouped) {
    const value = row._count._all;
    switch (row.status) {
      case "COMPLETED":
        counts.completed = value;
        counts.started += value;
        break;
      case "PRACTICED":
        counts.practiced = value;
        counts.started += value;
        break;
      case "IN_PROGRESS":
        counts.inProgress = value;
        counts.started += value;
        break;
      case "NEEDS_REVISION":
        counts.needsRevision = value;
        counts.started += value;
        break;
      default:
        break;
    }
  }

  // A topic whose master record was archived keeps its progress row but must not
  // shrink the denominator, so only in-scope progress counts here.
  if (counts.started > total) {
    const activeStarted = await prisma.userTopicProgress.count({
      where: { userId, status: { not: "NOT_STARTED" }, topic: { isActive: true } },
    });
    counts.started = activeStarted;
    counts.notStarted = Math.max(0, total - activeStarted);
  } else {
    counts.notStarted = Math.max(0, total - counts.started);
  }

  return counts;
}

/** Per-phase and per-difficulty completion, used by the dashboard and analytics. */
export async function getCompletionBreakdown(userId: string) {
  const [phases, progress] = await Promise.all([
    prisma.phase.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        title: true,
        order: true,
        color: true,
        difficulty: true,
        groups: {
          where: { isActive: true },
          select: {
            topics: {
              where: { isActive: true },
              select: {
                id: true,
                difficulty: true,
                userProgress: {
                  where: { userId },
                  select: { status: true },
                  take: 1,
                },
              },
            },
          },
        },
      },
    }),
    prisma.userTopicProgress.findMany({
      where: { userId, status: { in: ["COMPLETED", "PRACTICED", "IN_PROGRESS", "NEEDS_REVISION"] } },
      select: { status: true, topic: { select: { difficulty: true, isActive: true } } },
    }),
  ]);

  const phaseRows = phases.map((phase) => {
    const topics = phase.groups.flatMap((group) => group.topics);
    const completed = topics.filter(
      (topic) => topic.userProgress[0]?.status === "COMPLETED",
    ).length;
    const started = topics.filter((topic) => {
      const status = topic.userProgress[0]?.status;
      return status && status !== "NOT_STARTED";
    }).length;

    return {
      id: phase.id,
      title: phase.title,
      order: phase.order,
      color: phase.color,
      difficulty: phase.difficulty,
      total: topics.length,
      completed,
      started,
      percentage: topics.length > 0 ? Math.round((completed / topics.length) * 100) : 0,
    };
  });

  const difficultyOrder = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "SENIOR"] as const;
  const difficultyTotals = await prisma.topic.groupBy({
    by: ["difficulty"],
    where: { isActive: true },
    _count: { _all: true },
  });
  const totalByDifficulty = new Map(difficultyTotals.map((row) => [row.difficulty, row._count._all]));

  const completedByDifficulty = new Map<string, number>();
  const startedByDifficulty = new Map<string, number>();
  for (const row of progress) {
    if (!row.topic.isActive) continue;
    const key = row.topic.difficulty;
    if (row.status === "COMPLETED") completedByDifficulty.set(key, (completedByDifficulty.get(key) ?? 0) + 1);
    startedByDifficulty.set(key, (startedByDifficulty.get(key) ?? 0) + 1);
  }

  const difficultyRows = difficultyOrder.map((difficulty) => {
    const total = totalByDifficulty.get(difficulty) ?? 0;
    const completed = completedByDifficulty.get(difficulty) ?? 0;
    return {
      difficulty,
      total,
      completed,
      started: startedByDifficulty.get(difficulty) ?? 0,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  return { phases: phaseRows, difficulties: difficultyRows };
}

/** Topics the user is actively working through, most recent first. */
export async function getActiveTopics(userId: string, limit = 8) {
  return prisma.userTopicProgress.findMany({
    where: {
      userId,
      status: { in: ["IN_PROGRESS", "PRACTICED", "NEEDS_REVISION"] },
      topic: { isActive: true },
    },
    orderBy: [{ lastStudiedAt: "desc" }, { updatedAt: "desc" }],
    take: limit,
    select: {
      id: true,
      status: true,
      lastStudiedAt: true,
      startedAt: true,
      totalTimeMinutes: true,
      topic: {
        select: {
          id: true,
          slug: true,
          title: true,
          difficulty: true,
          estimatedMinutes: true,
          group: {
            select: { title: true, phase: { select: { title: true, order: true } } },
          },
        },
      },
    },
  });
}

export async function getRecentlyStudied(userId: string, limit = 8) {
  return prisma.userTopicProgress.findMany({
    where: { userId, lastStudiedAt: { not: null }, topic: { isActive: true } },
    orderBy: { lastStudiedAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      lastStudiedAt: true,
      completedAt: true,
      totalTimeMinutes: true,
      topic: {
        select: {
          id: true,
          slug: true,
          title: true,
          difficulty: true,
          group: {
            select: { title: true, phase: { select: { title: true, order: true } } },
          },
        },
      },
    },
  });
}

export async function getCompletedTopics(userId: string, limit = 100, offset = 0) {
  const where: Prisma.UserTopicProgressWhereInput = {
    userId,
    status: "COMPLETED",
    topic: { isActive: true },
  };

  const [rows, total] = await Promise.all([
    prisma.userTopicProgress.findMany({
      where,
      orderBy: { completedAt: "desc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        completedAt: true,
        totalTimeMinutes: true,
        topic: {
          select: {
            id: true,
            slug: true,
            title: true,
            difficulty: true,
            group: { select: { title: true, phase: { select: { title: true, order: true } } } },
          },
        },
      },
    }),
    prisma.userTopicProgress.count({ where }),
  ]);

  return { items: rows, total };
}

export async function getBookmarkedTopics(userId: string) {
  return prisma.bookmark.findMany({
    where: { userId, topic: { isActive: true } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
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
}

/**
 * Recommended next topics.
 *
 * Transparent rule, applied in order:
 *   1. resume topics already in progress (most recently studied first);
 *   2. then the earliest NOT_STARTED topic in the earliest phase that still has
 *      unmet work, skipping any topic whose prerequisites are all unmet *and*
 *      which the user has no progress on;
 *   3. topics needing revision are surfaced separately by the revision service.
 *
 * No scoring, no randomness: the same state always produces the same list.
 */
export async function getRecommendedTopics(userId: string, limit = 5) {
  const active = await getActiveTopics(userId, 3);

  const recommendations = active.map((row) => ({
    id: row.topic.id,
    slug: row.topic.slug,
    title: row.topic.title,
    difficulty: row.topic.difficulty,
    estimatedMinutes: row.topic.estimatedMinutes,
    status: row.status,
    reason: row.status === "NEEDS_REVISION" ? "You flagged this for revision" : "Continue where you left off",
    phaseTitle: row.topic.group.phase.title,
    phaseOrder: row.topic.group.phase.order,
  }));

  if (recommendations.length >= limit) return recommendations.slice(0, limit);

  const started = await prisma.userTopicProgress.findMany({
    where: { userId, status: { not: "NOT_STARTED" } },
    select: { topicId: true },
  });
  const startedIds = new Set(started.map((row) => row.topicId));

  const candidates = await prisma.topic.findMany({
    where: {
      isActive: true,
      id: { notIn: Array.from(startedIds) },
      group: { phase: { isActive: true }, isActive: true },
    },
    orderBy: [{ group: { phase: { order: "asc" } } }, { group: { order: "asc" } }, { order: "asc" }],
    take: 60,
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      estimatedMinutes: true,
      group: { select: { title: true, phase: { select: { title: true, order: true } } } },
      prerequisites: {
        select: {
          prerequisiteTopic: {
            select: {
              id: true,
              title: true,
              userProgress: { where: { userId }, select: { status: true }, take: 1 },
            },
          },
        },
      },
    },
  });

  for (const candidate of candidates) {
    if (recommendations.length >= limit) break;

    const unmet = candidate.prerequisites.filter(
      (entry) => entry.prerequisiteTopic.userProgress[0]?.status !== "COMPLETED",
    );

    recommendations.push({
      id: candidate.id,
      slug: candidate.slug,
      title: candidate.title,
      difficulty: candidate.difficulty,
      estimatedMinutes: candidate.estimatedMinutes,
      status: "NOT_STARTED",
      reason:
        unmet.length === 0
          ? `Next in ${candidate.group.phase.title}`
          : `Recommended after ${unmet[0]!.prerequisiteTopic.title}`,
      phaseTitle: candidate.group.phase.title,
      phaseOrder: candidate.group.phase.order,
    });
  }

  return recommendations;
}

/** Bookmark ids for a set of topics, for the roadmap canvas. */
export async function getBookmarkIds(userId: string, topicIds: string[]) {
  if (topicIds.length === 0) return new Set<string>();
  const rows = await prisma.bookmark.findMany({
    where: { userId, topicId: { in: topicIds } },
    select: { topicId: true },
  });
  return new Set(rows.map((row) => row.topicId));
}