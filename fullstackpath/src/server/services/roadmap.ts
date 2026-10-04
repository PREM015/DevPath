import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { Difficulty, Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/permissions";

/**
 * Roadmap content is shared by every user, so it is read through small,
 * purpose-built queries instead of one giant include. These helpers never
 * touch user data — user progress is layered on top separately by
 * `progress.ts`, which keeps the shared cache safe to reuse across users.
 */

export type PhaseSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  order: number;
  difficulty: Difficulty;
  color: string;
  icon: string | null;
  estimatedHours: number | null;
  objectives: string[];
  groupCount: number;
  topicCount: number;
  completedCount?: number;
};

export type GroupSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  order: number;
  difficulty: Difficulty;
  estimatedHours: number | null;
  objectives: string[];
  topicCount: number;
  completedCount?: number;
};

export type TopicSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  order: number;
  estimatedMinutes: number;
  groupId: string;
  groupTitle?: string;
  phaseId?: string;
  phaseTitle?: string;
  phaseOrder?: number;
  isArchived?: boolean;
  status?: string;
  completedAt?: Date | null;
  lastStudiedAt?: Date | null;
  blockedReason?: string | null;
};

/** All phases with counts only — used for the roadmap canvas and phase list. */
export async function getPhaseSummaries(): Promise<PhaseSummary[]> {
  const phases = await prisma.phase.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      order: true,
      difficulty: true,
      color: true,
      icon: true,
      estimatedHours: true,
      objectivesJson: true,
      groups: {
        where: { isActive: true },
        select: { id: true, _count: { select: { topics: { where: { isActive: true } } } } },
      },
    },
  });

  return phases.map((phase) => ({
    id: phase.id,
    slug: phase.slug,
    title: phase.title,
    description: phase.description,
    order: phase.order,
    difficulty: phase.difficulty,
    color: phase.color,
    icon: phase.icon,
    estimatedHours: phase.estimatedHours,
    objectives: (phase.objectivesJson as string[] | null) ?? [],
    groupCount: phase.groups.length,
    topicCount: phase.groups.reduce((sum, group) => sum + group._count.topics, 0),
  }));
}

export async function getGroupsForPhase(phaseId: string): Promise<GroupSummary[]> {
  const groups = await prisma.roadmapGroup.findMany({
    where: { phaseId, isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      order: true,
      difficulty: true,
      estimatedHours: true,
      objectivesJson: true,
      _count: { select: { topics: { where: { isActive: true } } } },
    },
  });

  return groups.map((group) => ({
    id: group.id,
    slug: group.slug,
    title: group.title,
    description: group.description,
    order: group.order,
    difficulty: group.difficulty,
    estimatedHours: group.estimatedHours,
    objectives: (group.objectivesJson as string[] | null) ?? [],
    topicCount: group._count.topics,
  }));
}

/**
 * Topics for a group. When `userId` is given, each topic is decorated with that
 * user's own progress row only — never another user's.
 */
export async function getTopicsForGroup(
  groupId: string,
  userId?: string,
  options?: { includeArchived?: boolean; search?: string; difficulties?: Difficulty[] },
): Promise<TopicSummary[]> {
  const includeArchived = options?.includeArchived ?? false;

  const topics = await prisma.topic.findMany({
    where: {
      groupId,
      ...(includeArchived ? {} : { isActive: true }),
      ...(options?.search
        ? {
            OR: [
              { title: { contains: options.search, mode: "insensitive" } },
              { description: { contains: options.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(options?.difficulties?.length
        ? { difficulty: { in: options.difficulties } }
        : {}),
    },
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      difficulty: true,
      order: true,
      estimatedMinutes: true,
      groupId: true,
      isActive: true,
      ...(userId
        ? {
            userProgress: {
              where: { userId },
              select: { status: true, completedAt: true, lastStudiedAt: true },
              take: 1,
            },
          }
        : {}),
    },
  });

  return topics.map((topic) => {
    const progress = "userProgress" in topic ? topic.userProgress[0] : undefined;
    return {
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      description: topic.description,
      difficulty: topic.difficulty,
      order: topic.order,
      estimatedMinutes: topic.estimatedMinutes,
      groupId: topic.groupId,
      isArchived: !topic.isActive,
      status: progress?.status ?? "NOT_STARTED",
      completedAt: progress?.completedAt ?? null,
      lastStudiedAt: progress?.lastStudiedAt ?? null,
    };
  });
}

/** Flat topic list used by search, the learning queue and topic pickers. */
export async function searchTopics(
  userId: string,
  options: {
    query?: string;
    phaseId?: string;
    difficulty?: Difficulty;
    status?: string;
    limit?: number;
    offset?: number;
    includeArchived?: boolean;
  } = {},
) {
  const limit = Math.min(options.limit ?? 50, 200);
  const offset = options.offset ?? 0;

  const where: Prisma.TopicWhereInput = {
    isActive: options.includeArchived ? undefined : true,
    ...(options.query
      ? {
          OR: [
            { title: { contains: options.query, mode: "insensitive" } },
            { description: { contains: options.query, mode: "insensitive" } },
            { group: { title: { contains: options.query, mode: "insensitive" } } },
            { group: { phase: { title: { contains: options.query, mode: "insensitive" } } } },
          ],
        }
      : {}),
    ...(options.phaseId ? { group: { phaseId: options.phaseId } } : {}),
    ...(options.difficulty ? { difficulty: options.difficulty } : {}),
  };

  const [topics, total] = await Promise.all([
    prisma.topic.findMany({
      where,
      orderBy: [{ group: { phase: { order: "asc" } } }, { group: { order: "asc" } }, { order: "asc" }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        difficulty: true,
        estimatedMinutes: true,
        isActive: true,
        group: {
          select: {
            id: true,
            title: true,
            phase: { select: { id: true, title: true, order: true } },
          },
        },
        userProgress: {
          where: { userId },
          select: { status: true, completedAt: true, lastStudiedAt: true, totalTimeMinutes: true },
          take: 1,
        },
        bookmarks: { where: { userId }, select: { id: true }, take: 1 },
      },
    }),
    prisma.topic.count({ where }),
  ]);

  return {
    items: topics.map((topic) => {
      const progress = topic.userProgress[0];
      return {
        id: topic.id,
        slug: topic.slug,
        title: topic.title,
        description: topic.description,
        difficulty: topic.difficulty,
        estimatedMinutes: topic.estimatedMinutes,
        isArchived: !topic.isActive,
        groupId: topic.group.id,
        groupTitle: topic.group.title,
        phaseId: topic.group.phase.id,
        phaseTitle: topic.group.phase.title,
        phaseOrder: topic.group.phase.order,
        status: progress?.status ?? "NOT_STARTED",
        completedAt: progress?.completedAt ?? null,
        lastStudiedAt: progress?.lastStudiedAt ?? null,
        totalTimeMinutes: progress?.totalTimeMinutes ?? 0,
        bookmarked: topic.bookmarks.length > 0,
      };
    }),
    total,
    offset,
    limit,
  };
}

/** Full detail for one topic, including prerequisites, relations and resources. */
export async function getTopicDetail(slug: string, userId: string) {
  const topic = await prisma.topic.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      difficulty: true,
      order: true,
      estimatedMinutes: true,
      isActive: true,
      objectivesJson: true,
      keyConceptsJson: true,
      commonMistakesJson: true,
      interviewJson: true,
      troubleshootingJson: true,
      referenceMarkdown: true,
      resourcesJson: true,
      practiceJson: true,
      interviewQsJson: true,
      group: {
        select: {
          id: true,
          title: true,
          slug: true,
          description: true,
          phase: {
            select: { id: true, title: true, slug: true, order: true, color: true },
          },
        },
      },
      prerequisites: {
        select: {
          prerequisiteTopic: {
            select: {
              id: true,
              slug: true,
              title: true,
              difficulty: true,
              isActive: true,
              userProgress: {
                where: { userId },
                select: { status: true },
                take: 1,
              },
            },
          },
        },
      },
      relationsFrom: {
        select: {
          relationType: true,
          targetTopic: {
            select: { id: true, slug: true, title: true, difficulty: true, isActive: true },
          },
        },
      },
      relationsTo: {
        select: {
          relationType: true,
          sourceTopic: {
            select: { id: true, slug: true, title: true, difficulty: true, isActive: true },
          },
        },
      },
      userProgress: {
        where: { userId },
        select: {
          status: true,
          startedAt: true,
          completedAt: true,
          lastStudiedAt: true,
          totalTimeMinutes: true,
          confidence: true,
          personalDifficulty: true,
        },
        take: 1,
      },
      studySessions: {
        where: { userId },
        orderBy: { startedAt: "desc" },
        take: 10,
        select: { id: true, startedAt: true, durationMinutes: true },
      },
      notes: {
        where: { userId },
        orderBy: { updatedAt: "desc" },
        take: 5,
        select: { id: true, title: true, updatedAt: true },
      },
      bookmarks: { where: { userId }, select: { id: true }, take: 1 },
      revisions: {
        where: { userId },
        select: {
          id: true,
          status: true,
          nextReviewAt: true,
          intervalDays: true,
          reviewCount: true,
        },
        take: 1,
      },
    },
  });

  if (!topic) throw new NotFoundError("That topic does not exist.");

  const progress = topic.userProgress[0] ?? null;

  const prerequisites = topic.prerequisites.map((entry) => ({
    id: entry.prerequisiteTopic.id,
    slug: entry.prerequisiteTopic.slug,
    title: entry.prerequisiteTopic.title,
    difficulty: entry.prerequisiteTopic.difficulty,
    isArchived: !entry.prerequisiteTopic.isActive,
    status: entry.prerequisiteTopic.userProgress[0]?.status ?? "NOT_STARTED",
  }));

  const unmet = prerequisites.filter((p) => p.status !== "COMPLETED" && !p.isArchived);
  const blockedReason =
    unmet.length > 0
      ? `Complete ${unmet.map((p) => p.title).join(", ")} first to unlock the recommended order. You can still study this topic now.`
      : null;

  type TopicResource = { title: string; url: string; type?: string; note?: string };
  type TopicQuestion = { text: string; answer: string; derived?: boolean };

  const interview = (topic.interviewJson ?? null) as {
    whyAsked?: string;
    evaluation?: string[];
    sayOutLoud?: string;
    probe?: string[];
    wrongAnswers?: string[];
    tradeoffs?: string[];
    signal?: string;
    prerequisites?: string[];
    questionCount?: number;
    answeredCount?: number;
  } | null;

  const troubleshooting = (topic.troubleshootingJson ?? null) as {
    symptoms?: string[];
    investigation?: string[];
    rootCause?: string[];
    fix?: string[];
    prevention?: string[];
    tools?: string[];
  } | null;

  return {
    id: topic.id,
    slug: topic.slug,
    title: topic.title,
    description: topic.description,
    difficulty: topic.difficulty,
    estimatedMinutes: topic.estimatedMinutes,
    isArchived: !topic.isActive,
    objectives: (topic.objectivesJson as string[] | null) ?? [],
    keyConcepts: (topic.keyConceptsJson as string[] | null) ?? [],
    commonMistakes: (topic.commonMistakesJson as string[] | null) ?? [],
    resources: (topic.resourcesJson as TopicResource[] | null) ?? [],
    practiceTasks: (topic.practiceJson as string[] | null) ?? [],
    interviewQuestions: (topic.interviewQsJson as TopicQuestion[] | null) ?? [],
    interview: {
      whyAsked: interview?.whyAsked ?? "",
      evaluation: interview?.evaluation ?? [],
      sayOutLoud: interview?.sayOutLoud ?? "",
      probe: interview?.probe ?? [],
      wrongAnswers: interview?.wrongAnswers ?? [],
      tradeoffs: interview?.tradeoffs ?? [],
      signal: interview?.signal ?? "",
      prerequisites: interview?.prerequisites ?? [],
      answeredCount: interview?.answeredCount ?? 0,
      questionCount: interview?.questionCount ?? 0,
    },
    troubleshooting: troubleshooting
      ? {
          symptoms: troubleshooting.symptoms ?? [],
          investigation: troubleshooting.investigation ?? [],
          rootCause: troubleshooting.rootCause ?? [],
          fix: troubleshooting.fix ?? [],
          prevention: troubleshooting.prevention ?? [],
          tools: troubleshooting.tools ?? [],
        }
      : null,
    referenceMarkdown: topic.referenceMarkdown ?? null,
    group: topic.group,
    prerequisites,
    related: [
      ...topic.relationsFrom.map((relation) => ({
        ...relation.targetTopic,
        isArchived: !relation.targetTopic.isActive,
        relationType: relation.relationType,
        direction: "outgoing" as const,
      })),
      ...topic.relationsTo.map((relation) => ({
        ...relation.sourceTopic,
        isArchived: !relation.sourceTopic.isActive,
        relationType: relation.relationType,
        direction: "incoming" as const,
      })),
    ],
    progress: progress
      ? {
          status: progress.status,
          startedAt: progress.startedAt,
          completedAt: progress.completedAt,
          lastStudiedAt: progress.lastStudiedAt,
          totalTimeMinutes: progress.totalTimeMinutes,
          confidence: progress.confidence,
          personalDifficulty: progress.personalDifficulty,
        }
      : null,
    recentSessions: topic.studySessions,
    notes: topic.notes,
    bookmarked: topic.bookmarks.length > 0,
    revision: topic.revisions[0] ?? null,
    blockedReason,
  };
}

/**
 * Lightweight endpoint data for the roadmap side panel: enough to render and
 * update status without shipping the whole topic page.
 */
export async function getTopicPanel(slug: string, userId: string) {
  const [topic, completedPrereqs] = await Promise.all([
    prisma.topic.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        difficulty: true,
        estimatedMinutes: true,
        isActive: true,
        keyConceptsJson: true,
        group: { select: { id: true, title: true, phase: { select: { title: true, order: true } } } },
        prerequisites: {
          select: {
            prerequisiteTopic: {
              select: {
                id: true,
                slug: true,
                title: true,
                userProgress: { where: { userId }, select: { status: true }, take: 1 },
              },
            },
          },
        },
        userProgress: {
          where: { userId },
          select: { status: true, completedAt: true, totalTimeMinutes: true },
          take: 1,
        },
        bookmarks: { where: { userId }, select: { id: true }, take: 1 },
        revisions: { where: { userId }, select: { id: true, nextReviewAt: true }, take: 1 },
      },
    }),
    prisma.topicPrerequisite.count({ where: { topic: { slug }, prerequisiteTopic: { userProgress: { some: { userId, status: "COMPLETED" } } } } }),
  ]);

  if (!topic) throw new NotFoundError("That topic does not exist.");

  const prereqTotal = topic.prerequisites.length;

  return {
    id: topic.id,
    slug: topic.slug,
    title: topic.title,
    description: topic.description,
    difficulty: topic.difficulty,
    estimatedMinutes: topic.estimatedMinutes,
    isArchived: !topic.isActive,
    keyConcepts: (topic.keyConceptsJson as string[] | null) ?? [],
    group: topic.group,
    status: topic.userProgress[0]?.status ?? "NOT_STARTED",
    completedAt: topic.userProgress[0]?.completedAt ?? null,
    totalTimeMinutes: topic.userProgress[0]?.totalTimeMinutes ?? 0,
    bookmarked: topic.bookmarks.length > 0,
    scheduledForRevision: Boolean(topic.revisions[0]),
    prerequisitesMet: completedPrereqs,
    prerequisitesTotal: prereqTotal,
  };
}

/**
 * Prerequisite edges for the canvas. Only edges between visible nodes are
 * returned so the client can drop the rest.
 */
export async function getPrerequisiteEdges(topicIds: string[]) {
  if (topicIds.length === 0) return [];

  return prisma.topicPrerequisite.findMany({
    where: { topicId: { in: topicIds } },
    select: { topicId: true, prerequisiteTopicId: true },
  });
}

/**
 * Completion counts per phase for one user.
 *
 * A single grouped query feeds every phase, rather than one query per phase,
 * so the roadmap canvas stays at a fixed number of round trips.
 */
export async function getPhaseProgressSummary(
  userId: string,
  phaseIds: string[],
): Promise<Map<string, { completed: number; total: number }>> {
  const result = new Map<string, { completed: number; total: number }>();
  if (phaseIds.length === 0) return result;

  const topics = await prisma.topic.findMany({
    where: { isActive: true, group: { phaseId: { in: phaseIds } } },
    select: {
      group: { select: { phaseId: true } },
      userProgress: { where: { userId }, select: { status: true }, take: 1 },
    },
  });

  for (const phaseId of phaseIds) {
    result.set(phaseId, { completed: 0, total: 0 });
  }

  for (const topic of topics) {
    const entry = result.get(topic.group.phaseId);
    if (!entry) continue;
    entry.total += 1;
    if (topic.userProgress[0]?.status === "COMPLETED") entry.completed += 1;
  }

  return result;
}

/** Archived topics, so historical progress stays reachable after archiving. */
export async function getArchivedTopics(userId: string) {
  const topics = await prisma.topic.findMany({
    where: { isActive: false },
    orderBy: [{ group: { phase: { order: "asc" } } }, { order: "asc" }],
    select: {
      id: true,
      slug: true,
      title: true,
      isActive: true,
      group: { select: { title: true, phase: { select: { title: true, order: true } } } },
      userProgress: {
        where: { userId },
        select: { status: true, completedAt: true },
        take: 1,
      },
    },
  });

  return topics.map((topic) => ({
    id: topic.id,
    slug: topic.slug,
    title: topic.title,
    groupTitle: topic.group.title,
    phaseTitle: topic.group.phase.title,
    phaseOrder: topic.group.phase.order,
    status: topic.userProgress[0]?.status ?? "NOT_STARTED",
    completedAt: topic.userProgress[0]?.completedAt ?? null,
  }));
}