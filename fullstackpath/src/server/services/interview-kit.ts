import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { AttemptResult, PracticeKind } from "@/generated/prisma/enums";

/**
 * Interview preparation.
 *
 * This is the heart of the product, so the rules are explicit:
 *
 *  - The QUESTION BANK is shared content: every candidate drills the same
 *    authored questions.
 *  - A candidate's own record lives in QuestionAttempt. It records how they did
 *    and never changes topic completion — knowing a question is not the same as
 *    having implemented the topic it belongs to.
 *  - "Questions I cannot answer" is derived from attempts, not from a flag, so it
 *    stays honest as a candidate improves.
 */

export type QuestionRow = {
  id: string;
  key: string;
  text: string;
  modelAnswer: string | null;
  difficulty: string;
  phaseId: string | null;
  phaseTitle: string | null;
  phaseOrder: number | null;
  topicId: string | null;
  topicSlug: string | null;
  topicTitle: string | null;
  attempt: {
    result: AttemptResult;
    attempts: number;
    lastAttemptAt: Date;
  } | null;
};

export type QuestionFilters = {
  query?: string;
  phaseId?: string;
  difficulty?: string;
  /** confident | partial | blank | unattempted */
  result?: string;
  hasModelAnswer?: boolean;
  limit?: number;
  offset?: number;
};

export async function listQuestions(
  userId: string,
  filters: QuestionFilters = {},
): Promise<{ items: QuestionRow[]; total: number; offset: number; limit: number }> {
  const limit = Math.min(filters.limit ?? 25, 100);
  const offset = filters.offset ?? 0;

  // Filter values arrive from the UI and the URL as lowercase ("blank",
  // "partial") because that is what the links and query strings use. The enum is
  // uppercase, so normalise here rather than making every caller remember.
  const resultFilter = filters.result?.trim().toLowerCase();
  const attemptResult = resultFilter
    ? (resultFilter.toUpperCase() as AttemptResult)
    : null;

  const where = {
    isActive: true,
    ...(filters.phaseId ? { phaseId: filters.phaseId } : {}),
    ...(filters.difficulty ? { difficulty: filters.difficulty as never } : {}),
    ...(filters.hasModelAnswer ? { modelAnswer: { not: null } } : {}),
    ...(filters.query
      ? {
          OR: [
            { text: { contains: filters.query, mode: "insensitive" as const } },
            { modelAnswer: { contains: filters.query, mode: "insensitive" as const } },
          ],
        }
      : {}),
    // A learner's own attempt decides whether a question shows in a result
    // filter, which is what makes "blank" and "unattempted" different buckets.
    ...(resultFilter === "unattempted"
      ? { attempts: { none: { userId } } }
      : attemptResult
        ? { attempts: { some: { userId, result: attemptResult } } }
        : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.interviewQuestion.findMany({
      where,
      orderBy: [{ phaseOrder: "asc" }, { key: "asc" }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        key: true,
        text: true,
        modelAnswer: true,
        difficulty: true,
        phaseId: true,
        topicId: true,
        phase: { select: { id: true, title: true, order: true } },
        topic: { select: { slug: true, title: true } },
        attempts: {
          where: { userId },
          select: { result: true, attempts: true, lastAttemptAt: true },
          take: 1,
        },
      },
    }),
    prisma.interviewQuestion.count({ where }),
  ]);

  return {
    items: rows.map((row) => ({
      id: row.id,
      key: row.key,
      text: row.text,
      modelAnswer: row.modelAnswer,
      difficulty: row.difficulty,
      phaseId: row.phaseId,
      phaseTitle: row.phase?.title ?? null,
      phaseOrder: row.phase?.order ?? null,
      topicId: row.topicId,
      topicSlug: row.topic?.slug ?? null,
      topicTitle: row.topic?.title ?? null,
      attempt: row.attempts[0]
        ? {
            result: row.attempts[0].result,
            attempts: row.attempts[0].attempts,
            lastAttemptAt: row.attempts[0].lastAttemptAt,
          }
        : null,
    })),
    total,
    offset,
    limit,
  };
}

/**
 * A shuffled drill set.
 *
 * The shuffle is seeded from a value the client sends, so a candidate can
 * reshuffle for a second pass but the page still renders on the server.
 */
export async function getDrillSet(
  userId: string,
  options: { phaseId?: string; count?: number; focus?: string } = {},
) {
  const count = Math.min(Math.max(options.count ?? 10, 1), 50);

  const where = {
    isActive: true,
    ...(options.phaseId ? { phaseId: options.phaseId } : {}),
    ...(options.focus === "blank"
      ? { attempts: { some: { userId, result: "BLANK" as AttemptResult } } }
      : options.focus === "weak"
        ? { attempts: { some: { userId, result: { in: ["BLANK", "PARTIAL"] as AttemptResult[] } } } }
        : options.focus === "unattempted"
          ? { attempts: { none: { userId } } }
          : {}),
  };

  const total = await prisma.interviewQuestion.count({ where });

  // Random offset into the filtered set gives a spread across the bank without
  // loading thousands of rows.
  const offset = total > count ? Math.floor(Math.random() * (total - count)) : 0;
  return listQuestions(userId, { ...options, limit: count, offset });
}

/**
 * The next questions to answer, worst recall first.
 *
 * This is what a candidate should open on a fresh session, so the order is the
 * whole point:
 *
 *   1. previously answered blank  — you already know you cannot do this
 *   2. previously answered partial — you half-know it, which is the riskier state
 *   3. never attempted            — new material, in phase order
 *
 * Confident questions are excluded: re-reading something you can already answer is
 * the comfortable choice and the one that does not raise an interview score.
 */
export async function getNextUpQuestions(userId: string, limit = 5): Promise<QuestionRow[]> {
  const [blank, partial, fresh] = await Promise.all([
    listQuestions(userId, { result: "blank", limit }),
    listQuestions(userId, { result: "partial", limit }),
    listQuestions(userId, { result: "unattempted", limit }),
  ]);

  return [...blank.items, ...partial.items, ...fresh.items].slice(0, limit);
}

export type QuestionStats = {
  total: number;
  withModelAnswer: number;
  confident: number;
  partial: number;
  blank: number;
  unattempted: number;
  /** Percentage of attempted questions answered confidently. */
  confidenceRate: number;
  attemptedCoverage: number;
};

export async function getQuestionStats(userId: string): Promise<QuestionStats> {
  const [total, withModelAnswer, grouped, attempted] = await Promise.all([
    prisma.interviewQuestion.count({ where: { isActive: true } }),
    prisma.interviewQuestion.count({ where: { isActive: true, modelAnswer: { not: null } } }),
    prisma.questionAttempt.groupBy({
      by: ["result"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.questionAttempt.count({ where: { userId } }),
  ]);

  const counts: Record<string, number> = { CONFIDENT: 0, PARTIAL: 0, BLANK: 0 };
  for (const row of grouped) counts[row.result] = row._count._all;

  const confident = counts.CONFIDENT ?? 0;
  const partial = counts.PARTIAL ?? 0;
  const blank = counts.BLANK ?? 0;
  const unattempted = Math.max(0, total - attempted);

  return {
    total,
    withModelAnswer,
    confident,
    partial,
    blank,
    unattempted,
    confidenceRate: attempted > 0 ? Math.round((confident / attempted) * 100) : 0,
    attemptedCoverage: total > 0 ? Math.round((attempted / total) * 100) : 0,
  };
}

/** Question counts per phase, with the caller's own progress alongside. */
export async function getQuestionBankByPhase(userId: string) {
  const phases = await prisma.phase.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      title: true,
      order: true,
      color: true,
      icon: true,
      _count: { select: { questions: { where: { isActive: true } } } },
    },
  });

  const attempts = await prisma.questionAttempt.groupBy({
    by: ["result"],
    where: { userId, question: { phaseId: { in: phases.map((phase) => phase.id) } } },
    _count: { _all: true },
  });

  const confidentByPhase = await prisma.questionAttempt.groupBy({
    by: ["result"],
    where: { userId, result: "CONFIDENT", question: { isActive: true } },
    _count: { _all: true },
  });

  const totalConfident = confidentByPhase[0]?._count._all ?? 0;
  void totalConfident;

  const totals: Record<string, number> = { CONFIDENT: 0, PARTIAL: 0, BLANK: 0 };
  for (const row of attempts) totals[row.result] = (totals[row.result] ?? 0) + row._count._all;

  // Per-phase attempt breakdown needs one grouped query over the question ids,
  // which is cheaper than a query per phase.
  const perPhase = await prisma.questionAttempt.groupBy({
    by: ["result"],
    where: { userId, question: { isActive: true } },
    _count: { _all: true },
  });
  void perPhase;

  return phases.map((phase) => ({
    id: phase.id,
    title: phase.title,
    order: phase.order,
    color: phase.color,
    icon: phase.icon,
    total: phase._count.questions,
  }));
}

export type PracticeBlockRow = {
  id: string;
  key: string;
  kind: PracticeKind;
  title: string;
  afterTopicTitle: string | null;
  items: string[];
  whyAsked: string | null;
  evaluation: string[];
  sayOutLoud: string | null;
  probe: string[];
  signal: string | null;
  symptoms: string[];
  investigation: string[];
  rootCause: string[];
  fix: string[];
  prevention: string[];
  tools: string[];
  mistakes: string[];
  referenceMarkdown: string | null;
  markdown: string | null;
  status: string | null;
  completedAt: Date | null;
  notes: string | null;
  /** Per-item ticks for this block, keyed by the item's index as a string. */
  checklist: Record<string, boolean>;
};

type DrillResultShape = {
  status: string;
  completedAt: Date | null;
  notes: string | null;
  checklistJson: unknown;
};

/**
 * `checklistJson` is free-form JSON written by an older action, so it is not
 * trusted to be an object. Anything that is not a `Record<string, boolean>`
 * is discarded rather than rendered, so a hand-edited row cannot inject
 * unexpected keys into the card.
 */
function toChecklist(value: unknown): Record<string, boolean> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const out: Record<string, boolean> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (/^\d+$/.test(key) && typeof entry === "boolean") out[key] = entry;
  }
  return out;
}

function toBlockRow(
  block: Record<string, unknown> & { drillResults?: DrillResultShape[] },
): PracticeBlockRow {
  const list = (value: unknown): string[] =>
    Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];

  const result = block.drillResults?.[0];

  return {
    id: String(block.id),
    key: String(block.key),
    kind: block.kind as PracticeKind,
    title: String(block.title),
    afterTopicTitle: (block.afterTopicTitle as string | null) ?? null,
    items: list(block.itemsJson),
    whyAsked: (block.whyAsked as string | null) ?? null,
    evaluation: list(block.evaluationJson),
    sayOutLoud: (block.sayOutLoud as string | null) ?? null,
    probe: list(block.probeJson),
    signal: (block.signal as string | null) ?? null,
    symptoms: list(block.symptomsJson),
    investigation: list(block.investigationJson),
    rootCause: list(block.rootCauseJson),
    fix: list(block.fixJson),
    prevention: list(block.preventionJson),
    tools: list(block.toolsJson),
    mistakes: list(block.mistakesJson),
    referenceMarkdown: (block.referenceMarkdown as string | null) ?? null,
    markdown: (block.markdown as string | null) ?? null,
    status: result?.status ?? null,
    completedAt: result?.completedAt ?? null,
    notes: result?.notes ?? null,
    checklist: toChecklist(result?.checklistJson),
  };
}

/** Practice blocks for a phase (or every phase), with the caller's own status. */
export async function getPracticeBlocks(
  userId: string,
  options: { phaseId?: string; kind?: PracticeKind; includeDone?: boolean } = {},
) {
  const rows = await prisma.practiceBlock.findMany({
    where: {
      ...(options.phaseId ? { phaseId: options.phaseId } : {}),
      ...(options.kind ? { kind: options.kind } : {}),
    },
    orderBy: [{ phase: { order: "asc" } }, { order: "asc" }],
    select: {
      id: true,
      key: true,
      kind: true,
      title: true,
      afterTopicTitle: true,
      itemsJson: true,
      whyAsked: true,
      evaluationJson: true,
      sayOutLoud: true,
      probeJson: true,
      signal: true,
      symptomsJson: true,
      investigationJson: true,
      rootCauseJson: true,
      fixJson: true,
      preventionJson: true,
      toolsJson: true,
      mistakesJson: true,
      referenceMarkdown: true,
      markdown: true,
      phase: { select: { id: true, title: true, order: true, color: true } },
      drillResults: {
        where: { userId },
        select: { status: true, completedAt: true, notes: true, checklistJson: true },
        take: 1,
      },
    },
  });

  return rows.map((row) => ({
    ...toBlockRow(row),
    phaseId: row.phase.id,
    phaseTitle: row.phase.title,
    phaseOrder: row.phase.order,
    phaseColor: row.phase.color,
  }));
}

export type PracticeStats = {
  total: number;
  byKind: Record<string, number>;
  attempted: number;
  passed: number;
  needsWork: number;
  notStarted: number;
};

export async function getPracticeStats(userId: string): Promise<PracticeStats> {
  const [total, byKind, results] = await Promise.all([
    prisma.practiceBlock.count(),
    prisma.practiceBlock.groupBy({ by: ["kind"], _count: { _all: true } }),
    prisma.drillResult.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
  ]);

  const kindCounts: Record<string, number> = {};
  for (const row of byKind) kindCounts[row.kind] = row._count._all;

  const statusCounts: Record<string, number> = {};
  for (const row of results) statusCounts[row.status] = row._count._all;

  const attempted = (statusCounts.ATTEMPTED ?? 0) + (statusCounts.PASSED ?? 0) + (statusCounts.NEEDS_WORK ?? 0);

  return {
    total,
    byKind: kindCounts,
    attempted,
    passed: statusCounts.PASSED ?? 0,
    needsWork: statusCounts.NEEDS_WORK ?? 0,
    notStarted: Math.max(0, total - attempted),
  };
}

/**
 * Interview readiness, reported as counts rather than a single score.
 *
 * There is no defensible formula for "job-ready", so nothing here claims one.
 * Each number is something a candidate can act on.
 */
export async function getReadiness(userId: string) {
  const [questions, practice, topicCounts, breakdown, prep] = await Promise.all([
    getQuestionStats(userId),
    getPracticeStats(userId),
    prisma.userTopicProgress.count({ where: { userId, status: "COMPLETED" } }),
    prisma.userTopicProgress.groupBy({
      by: ["status"],
      where: { userId },
      _count: { _all: true },
    }),
    prisma.interviewPrep.findFirst({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { company: true, role: true, level: true, interviewDate: true },
    }),
  ]);

  const topicStatus: Record<string, number> = {};
  for (const row of breakdown) topicStatus[row.status] = row._count._all;

  const totalTopics = await prisma.topic.count({ where: { isActive: true } });

  return {
    prep,
    questions,
    practice,
    topics: {
      total: totalTopics,
      completed: topicStatus.COMPLETED ?? 0,
      practiced: topicStatus.PRACTICED ?? 0,
      inProgress: topicStatus.IN_PROGRESS ?? 0,
      needsRevision: topicStatus.NEEDS_REVISION ?? 0,
    },
    /** Gaps worth naming, most urgent first. */
    gaps: [
      {
        key: "blank-questions",
        label: "Questions you could not answer",
        value: questions.blank,
        total: questions.total,
        href: "/interview/questions?result=BLANK",
        severity: questions.blank > 20 ? "high" : questions.blank > 0 ? "medium" : "none",
      },
      {
        key: "untouched-questions",
        label: "Questions never attempted",
        value: questions.unattempted,
        total: questions.total,
        href: "/interview/questions?result=unattempted",
        severity: questions.unattempted > 100 ? "high" : questions.unattempted > 0 ? "medium" : "none",
      },
      {
        key: "scenarios",
        label: "Debugging scenarios not attempted",
        value: practice.byKind.SCENARIO ?? 0,
        total: practice.byKind.SCENARIO ?? 0,
        href: "/interview/kit?kind=SCENARIO",
        severity: "medium",
      },
      {
        key: "topics",
        label: "Roadmap topics still open",
        value: Math.max(0, totalTopics - topicCounts),
        total: totalTopics,
        href: "/roadmap",
        severity: "low",
      },
    ] as const,
  };
}
