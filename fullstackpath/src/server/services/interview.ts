import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Interview preparation.
 *
 * The readiness summary is a count of concrete preparation artefacts the user has
 * actually recorded — completed topics tagged as coding/system-design/behavioral,
 * logged mock interviews and personal notes. It is deliberately NOT a single
 * "job-ready score": there is no defensible formula for that, so the page reports
 * what is done and what is not instead.
 */

export const PREP_TRACKS = [
  {
    key: "coding",
    title: "Coding interviews",
    description:
      "Data structures, algorithm patterns and timed problem solving. Tracked through the DSA phases of the roadmap.",
    phaseTitles: ["Coding Challenges, CS Fundamentals and DSA"],
    topicsPerDay: 2,
  },
  {
    key: "system-design",
    title: "System design",
    description:
      "Estimation, scalability, distributed systems and classic case studies. Tracked through the System Design phase.",
    phaseTitles: ["System Design", "Architecture Patterns and Low-Level Design"],
    topicsPerDay: 1,
  },
  {
    key: "behavioral",
    title: "Behavioral and culture",
    description:
      "Storytelling, collaboration and engineering practice. Tracked through the Behavioral phase and your own written stories.",
    phaseTitles: ["Behavioral and Engineering Culture"],
    topicsPerDay: 1,
  },
] as const;

export type PrepTrack = {
  key: string;
  title: string;
  description: string;
  total: number;
  completed: number;
  percentage: number;
  phaseIds: string[];
};

export async function getPrepTracks(userId: string): Promise<PrepTrack[]> {
  const phases = await prisma.phase.findMany({
    where: { isActive: true, title: { in: [...PREP_TRACKS.flatMap((t) => t.phaseTitles)] } },
    select: {
      id: true,
      title: true,
      groups: {
        where: { isActive: true },
        select: {
          topics: {
            where: { isActive: true },
            select: {
              id: true,
              userProgress: { where: { userId }, select: { status: true }, take: 1 },
            },
          },
        },
      },
    },
  });

  return PREP_TRACKS.map((track) => {
    const matching = phases.filter((phase) =>
      (track.phaseTitles as readonly string[]).includes(phase.title),
    );
    const topics = matching.flatMap((phase) => phase.groups.flatMap((group) => group.topics));
    const completed = topics.filter(
      (topic) => topic.userProgress[0]?.status === "COMPLETED",
    ).length;

    return {
      key: track.key,
      title: track.title,
      description: track.description,
      total: topics.length,
      completed,
      percentage: topics.length > 0 ? Math.round((completed / topics.length) * 100) : 0,
      phaseIds: matching.map((phase) => phase.id),
    };
  });
}

export async function getMockInterviews(userId: string, limit = 25) {
  return prisma.mockInterview.findMany({
    where: { userId },
    orderBy: { performedAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      company: true,
      round: true,
      kind: true,
      outcome: true,
      difficulty: true,
      durationMinutes: true,
      notes: true,
      performedAt: true,
    },
  });
}

export async function getInterviewStats(userId: string) {
  const [total, byOutcome, notesCount] = await Promise.all([
    prisma.mockInterview.count({ where: { userId } }),
    prisma.mockInterview.groupBy({
      by: ["outcome"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.userNote.count({
      where: {
        userId,
        topic: { group: { phase: { title: { in: [...PREP_TRACKS.flatMap((t) => t.phaseTitles)] } } } },
      },
    }),
  ]);

  const outcomes: Record<string, number> = {};
  for (const row of byOutcome) {
    if (row.outcome) outcomes[row.outcome] = row._count._all;
  }

  return { total, outcomes, notesCount };
}

/** Interview questions drawn from the roadmap, grouped by phase. */
export async function getQuestionBank(phaseSlug: string, userId: string, limit = 40) {
  const topics = await prisma.topic.findMany({
    where: { isActive: true, group: { phase: { slug: phaseSlug, isActive: true } } },
    orderBy: [{ group: { order: "asc" } }, { order: "asc" }],
    take: limit,
    select: {
      id: true,
      slug: true,
      title: true,
      interviewQsJson: true,
      userProgress: { where: { userId }, select: { status: true }, take: 1 },
      group: { select: { title: true } },
    },
  });

  return topics.map((topic) => ({
    id: topic.id,
    slug: topic.slug,
    title: topic.title,
    groupTitle: topic.group.title,
    status: topic.userProgress[0]?.status ?? "NOT_STARTED",
    questions: ((topic.interviewQsJson as string[] | null) ?? []).slice(0, 6),
  }));
}

/** Phases available for browsing the question bank. */
export async function getQuestionBankPhases() {
  return prisma.phase.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: { slug: true, title: true, order: true },
  });
}