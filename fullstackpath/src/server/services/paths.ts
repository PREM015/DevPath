import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getCompletionBreakdown, getTopicCounts } from "./progress";

/**
 * Role and level paths.
 *
 * These are transparent prioritisation, not gates: every rule below only decides
 * what is *suggested first*, and the full roadmap stays visible and completable
 * for every user regardless of their role or level.
 *
 * Priorities per role (topic difficulty and phase are the inputs):
 *   FRONTEND  phases 3, 4, 9 weighted highest; phases 5, 6 medium.
 *   BACKEND   phases 5, 6, 8 weighted highest; phases 3, 4 medium.
 *   BALANCED  all phases weighted equally.
 *   STARTUP   phases 1, 2, 4, 5 highest (breadth and shipping); 11-12 lower.
 *
 * Levels shift emphasis rather than removing anything:
 *   JUNIOR phases 2-6 emphasis, 10 (easy/medium) medium, 11-15 low.
 *   MID    phases 3-8 emphasis, 10-12 medium.
 *   SENIOR phases 10-12 emphasis, 8 medium.
 *   STAFF  phases 11-12 emphasis, 14-15 medium.
 */

const ROLE_PHASE_WEIGHT: Record<string, Record<number, number>> = {
  FRONTEND: { 2: 0.8, 3: 1.2, 4: 1.3, 5: 0.6, 6: 0.5, 7: 0.7, 8: 0.4, 9: 1.1, 10: 0.6, 15: 0.5 },
  BACKEND: { 2: 0.8, 3: 0.6, 4: 0.6, 5: 1.3, 6: 1.3, 7: 1.2, 8: 1.2, 9: 0.7, 10: 0.7, 15: 0.5 },
  BALANCED: {},
  STARTUP: { 1: 1.2, 2: 1.2, 3: 0.9, 4: 1.0, 5: 1.0, 6: 0.8, 7: 0.7, 8: 0.9, 9: 0.7, 11: 0.5, 12: 0.4 },
};

const LEVEL_PHASE_WEIGHT: Record<string, Record<number, number>> = {
  JUNIOR: { 2: 1.2, 3: 1.1, 4: 1.0, 5: 1.0, 6: 1.0, 10: 1.0, 11: 0.4, 12: 0.3, 14: 0.5 },
  MID: { 2: 0.8, 3: 1.0, 4: 1.0, 5: 1.0, 6: 1.0, 7: 1.0, 8: 0.8, 10: 0.9, 11: 0.7, 12: 0.6 },
  SENIOR: { 7: 1.1, 8: 1.2, 10: 1.0, 11: 1.2, 12: 1.3, 14: 1.1 },
  STAFF: { 11: 1.3, 12: 1.3, 13: 1.2, 14: 1.2, 15: 1.1 },
};

const DIFFICULTY_WEIGHT: Record<string, number> = {
  BEGINNER: 1.0,
  INTERMEDIATE: 0.95,
  ADVANCED: 0.8,
  SENIOR: 0.7,
};

export type PathPhase = {
  id: string;
  title: string;
  order: number;
  color: string;
  difficulty: string;
  total: number;
  completed: number;
  percentage: number;
  /** 0-3; how strongly this phase is recommended for the user's path. */
  priority: number;
  reason: string;
};

export type LearningPath = {
  role: string;
  level: string;
  /** Phases in recommended order, highest priority first. */
  phases: PathPhase[];
  focus: string[];
  counts: Awaited<ReturnType<typeof getTopicCounts>>;
};

/** Builds the suggested order for a user's role and level. */
export async function getLearningPath(
  userId: string,
  role: string,
  level: string,
): Promise<LearningPath> {
  const [breakdown, counts] = await Promise.all([
    getCompletionBreakdown(userId),
    getTopicCounts(userId),
  ]);

  const roleWeights = ROLE_PHASE_WEIGHT[role] ?? ROLE_PHASE_WEIGHT.BALANCED!;
  const levelWeights = LEVEL_PHASE_WEIGHT[level] ?? {};

  const phases: PathPhase[] = breakdown.phases.map((phase) => {
    const roleWeight = roleWeights[phase.order] ?? 1;
    const levelWeight = levelWeights[phase.order] ?? 1;
    const weight = roleWeight * levelWeight;

    let priority: number;
    let reason: string;

    if (weight >= 1.3) {
      priority = 3;
      reason = "Core to your target role and level";
    } else if (weight >= 1.05) {
      priority = 2;
      reason = "Strongly recommended for your target";
    } else if (weight >= 0.8) {
      priority = 1;
      reason = "Useful supporting knowledge";
    } else {
      priority = 0;
      reason = "Worth knowing, but not required for your target";
    }

    return {
      id: phase.id,
      title: phase.title,
      order: phase.order,
      color: phase.color,
      difficulty: phase.difficulty,
      total: phase.total,
      completed: phase.completed,
      percentage: phase.percentage,
      priority,
      reason,
    };
  });

  const roleOrder = phases
    .filter((phase) => phase.priority >= 2 && phase.completed < phase.total)
    .sort((a, b) => a.order - b.order)
    .slice(0, 4)
    .map((phase) => phase.title);

  return {
    role,
    level,
    phases: phases.sort((a, b) => b.priority - a.priority || a.order - b.order),
    focus: roleOrder,
    counts,
  };
}

/** Topics worth doing next under the user's path, highest weight first. */
export async function getPathTopics(userId: string, role: string, level: string, limit = 10) {
  const path = await getLearningPath(userId, role, level);
  const recommendedPhaseIds = path.phases
    .filter((phase) => phase.priority >= 2)
    .map((phase) => phase.id);

  if (recommendedPhaseIds.length === 0) return [];

  const started = await prisma.userTopicProgress.findMany({
    where: { userId, status: { not: "NOT_STARTED" } },
    select: { topicId: true },
  });
  const startedIds = started.map((row) => row.topicId);

  const candidates = await prisma.topic.findMany({
    where: {
      isActive: true,
      id: { notIn: startedIds },
      group: { phaseId: { in: recommendedPhaseIds } },
    },
    orderBy: [
      { group: { phase: { order: "asc" } } },
      { group: { order: "asc" } },
      { order: "asc" },
    ],
    select: {
      id: true,
      difficulty: true,
      group: { select: { phase: { select: { id: true, order: true } } } },
    },
  });

  const phasePriority = new Map(path.phases.map((phase) => [phase.id, phase.priority]));
  const levelWeight = LEVEL_PHASE_WEIGHT[level] ?? {};

  // Score every candidate, not an arbitrary prefix of them. The roadmap is
  // ~2,000 topics and a phase can hold several hundred, so truncating in the
  // database before scoring would quietly drop the strongest topics in
  // whichever phase happened to sort last.
  const scored = candidates
    .map((topic) => ({
      id: topic.id,
      score:
        (phasePriority.get(topic.group.phase.id) ?? 0) *
        (DIFFICULTY_WEIGHT[topic.difficulty] ?? 1) *
        (levelWeight[topic.group.phase.order] ?? 1),
      phaseOrder: topic.group.phase.order,
    }))
    .sort((a, b) => b.score - a.score || a.phaseOrder - b.phaseOrder)
    .slice(0, limit)
    .map((entry) => entry.id);

  if (scored.length === 0) return [];

  // Fetch display fields for the winners only, preserving the scored order.
  const winners = await prisma.topic.findMany({
    where: { id: { in: scored } },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      estimatedMinutes: true,
      group: {
        select: {
          title: true,
          phase: { select: { title: true, order: true } },
        },
      },
    },
  });
  const byId = new Map(winners.map((topic) => [topic.id, topic]));

  return scored
    .map((id) => byId.get(id))
    .filter((topic): topic is NonNullable<typeof topic> => Boolean(topic))
    .map((topic) => ({
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      difficulty: topic.difficulty,
      estimatedMinutes: topic.estimatedMinutes,
      phaseTitle: topic.group.phase.title,
      groupTitle: topic.group.title,
      reason: `Recommended for your ${role.toLowerCase()} ${level.toLowerCase()} path`,
    }));
}