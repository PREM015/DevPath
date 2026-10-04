/**
 * Interview-prep seeding.
 *
 * Runs after the roadmap seed and builds the two interview-first structures:
 *
 *  1. InterviewQuestion — every question in the source becomes a row with a
 *     stable key, its model answer, and the topic/phase it belongs to. Questions
 *     are SHARED; only a candidate's own attempts are per user.
 *
 *  2. PracticeBlock — drills, scenarios, rapid-fire sets, Q&A banks,
 *     machine-coding prompts and readiness checklists, filed against their
 *     phase. These are practice, not knowledge, which is why they are not topics.
 *
 * Both are upserted by key, so re-seeding refreshes text without creating
 * duplicates and without touching any candidate's attempt records.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";
import type { Difficulty } from "../src/generated/prisma/enums.js";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 2 }),
});

const PRACTICE_KIND: Record<string, "DRILL" | "SCENARIO" | "RAPIDFIRE" | "QA" | "MACHINE_CODING" | "CHECKLIST" | "REFERENCE"> = {
  drill: "DRILL",
  scenario: "SCENARIO",
  rapidfire: "RAPIDFIRE",
  qa: "QA",
  machineCoding: "MACHINE_CODING",
  checklist: "CHECKLIST",
  reference: "REFERENCE",
};

/** The subset of a phase file the interview seeder needs. */
type SeedPhase = {
  slug: string;
  order: number;
  practice?: {
    kind?: string;
    title?: string;
    afterTopic?: string | null;
    items?: unknown;
    questions?: SeedQuestion[];
    whyAsked?: string;
    evaluation?: string[];
    sayOutLoud?: string;
    probe?: string[];
    signal?: string;
    symptoms?: string[];
    investigation?: string[];
    rootCause?: string[];
    fix?: string[];
    prevention?: string[];
    tools?: string[];
    mistakes?: string[];
    reference?: string | null;
    markdown?: string | null;
  }[];
  groups?: {
    slug: string;
    title: string;
    topics?: { slug: string; title: string; difficulty: string; interviewQuestions?: unknown }[];
  }[];
};

type SeedQuestion = { text: string; answer: string; derived?: boolean };

/** Stable key for a question: its topic plus its ordinal, so re-parsing the
 *  source updates the same row instead of adding a near-duplicate. */
function questionKey(topicSlug: string, index: number): string {
  return `${topicSlug}::q${index + 1}`;
}

/**
 * Stable identity for a practice block.
 *
 * The ordinal is part of the key on purpose: the same archetype title appears
 * more than once in some phases (a "RAPID-FIRE" per section), so title alone
 * would collapse two distinct blocks into one row and silently drop content.
 */
function blockKey(
  phaseSlug: string,
  block: NonNullable<SeedPhase["practice"]>[number],
  ordinal: number,
): string {
  const slug = (block.title ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${phaseSlug}::${block.kind}::${slug}::${ordinal}`;
}

/** Keeps tag lists short and lowercase so search and filters behave. */
function toTags(text: string | undefined): string[] {
  return Array.from(
    new Set(
      (text ?? "")
        .toLowerCase()
        .split(/[^a-z0-9+#.]+/)
        .map((token) => token.trim())
        .filter((token) => token.length > 2 && token.length < 24),
    ),
  ).slice(0, 8);
}

function toQuestions(value: unknown): SeedQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (entry): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null,
    )
    .filter((entry) => typeof entry.text === "string" && entry.text.trim().length > 0)
    .map((entry) => ({
      text: String(entry.text).replace(/\s+/g, " ").trim(),
      answer: typeof entry.answer === "string" ? entry.answer.replace(/\s+/g, " ").trim() : "",
      ...(entry.derived === true ? { derived: true } : {}),
    }));
}

function toStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export async function seedInterviewContent(phases: SeedPhase[]) {
  const phaseBySlug = new Map(phases.map((phase) => [phase.slug, phase]));
  const topicMeta = new Map();

  for (const phase of phases) {
    for (const group of phase.groups ?? []) {
      for (const topic of group.topics ?? []) {
        topicMeta.set(topic.slug, {
          slug: topic.slug,
          title: topic.title,
          groupSlug: group.slug,
          phaseSlug: phase.slug,
        });
      }
    }
  }

  let questionCount = 0;
  let questionsWithAnswers = 0;
  let blockCount = 0;
  let blockItemCount = 0;
  // Every key written this run. Anything in the database that is not in these
  // sets came from an earlier parse of source text that has since been edited,
  // and is kept only as a Candidate's own attempt rows are untouched.
  const seenQuestionKeys = new Set<string>();
  const seenBlockKeys = new Set<string>();

  // ── Questions ────────────────────────────────────────────────
  for (const phase of phases) {
    for (const group of phase.groups ?? []) {
      for (const topic of group.topics ?? []) {
        const questions = toQuestions(topic.interviewQuestions);
        if (questions.length === 0) continue;

        for (const [index, question] of questions.entries()) {
          const key = questionKey(topic.slug, index);
          seenQuestionKeys.add(key);

          await prisma.interviewQuestion.upsert({
            where: { key },
            create: {
              key,
              text: question.text,
              modelAnswer: question.answer || null,
              // topicId/phaseId/groupId are filled in a second pass, once the
              // roadmap rows exist; see the linking step below.
              topicId: null,
              phaseId: null,
              groupId: null,
              difficulty: topic.difficulty as Difficulty,
              tagsJson: toTags(`${topic.title} ${group.title}`),
              phaseOrder: phase.order,
            },
            update: {
              text: question.text,
              modelAnswer: question.answer || null,
              difficulty: topic.difficulty as Difficulty,
              tagsJson: toTags(`${topic.title} ${group.title}`),
              phaseOrder: phase.order,
            },
          });

          questionCount += 1;
          if (question.answer) questionsWithAnswers += 1;
        }
      }
    }
  }

  // Link questions to their topic/phase now that the rows exist. Done in bulk to
  // avoid one update per question.
  const topicRows = await prisma.topic.findMany({
    where: { slug: { in: Array.from(topicMeta.keys()) } },
    select: { id: true, slug: true, group: { select: { id: true, phaseId: true } } },
  });
  const topicIdBySlug = new Map(topicRows.map((row) => [row.slug, row]));

  const questions = await prisma.interviewQuestion.findMany({
    where: { topicId: null },
    select: { id: true, key: true },
  });

  for (const question of questions) {
    const slug = question.key.split("::")[0];
    const topic = topicIdBySlug.get(slug);
    if (!topic) continue;
    await prisma.interviewQuestion.update({
      where: { id: question.id },
      data: { topicId: topic.id, phaseId: topic.group.phaseId, groupId: topic.group.id },
    });
  }

  // ── Practice blocks ──────────────────────────────────────────
  // Phase ids are resolved up front because `phaseId` is required: a block
  // without a phase has nowhere to live and would be unreachable in the UI.
  const phaseRows = await prisma.phase.findMany({
    where: { slug: { in: Array.from(phaseBySlug.keys()) } },
    select: { id: true, slug: true },
  });
  const phaseIdBySlug = new Map(phaseRows.map((row) => [row.slug, row.id]));

  for (const phase of phases) {
    const blocks = Array.isArray(phase.practice) ? phase.practice : [];
    if (blocks.length === 0) continue;

    const phaseId = phaseIdBySlug.get(phase.slug);
    if (!phaseId) {
      console.warn(`  skipping practice blocks for unknown phase: ${phase.slug}`);
      continue;
    }

    for (const [order, block] of blocks.entries()) {
      const key = blockKey(phase.slug, block, order);
      seenBlockKeys.add(key);
      const items = toStrings(block.items);

      const data = {
        kind: PRACTICE_KIND[block.kind ?? ""] ?? "REFERENCE",
        title: block.title ?? "Practice",
        afterTopicTitle: block.afterTopic ?? null,
        itemsJson: items,
        whyAsked: block.whyAsked || null,
        evaluationJson: block.evaluation?.length ? block.evaluation : undefined,
        sayOutLoud: block.sayOutLoud || null,
        probeJson: block.probe?.length ? block.probe : undefined,
        signal: block.signal || null,
        symptomsJson: block.symptoms?.length ? block.symptoms : undefined,
        investigationJson: block.investigation?.length ? block.investigation : undefined,
        rootCauseJson: block.rootCause?.length ? block.rootCause : undefined,
        fixJson: block.fix?.length ? block.fix : undefined,
        preventionJson: block.prevention?.length ? block.prevention : undefined,
        toolsJson: block.tools?.length ? block.tools : undefined,
        mistakesJson: block.mistakes?.length ? block.mistakes : undefined,
        referenceMarkdown: block.reference || null,
        markdown: block.markdown || null,
        order: order + 1,
      };

      await prisma.practiceBlock.upsert({
        where: { key },
        create: { key, phaseId, ...data },
        update: data,
      });

      blockCount += 1;
      blockItemCount += items.length;

      // ── Questions authored inside a practice block ───────────
      // Rapid-fire sets and Q&A banks are written as markdown tables. Those rows
      // are real questions with real key points, so they belong in the bank too,
      // otherwise a candidate cannot find or self-test them by topic.
      const blockQuestions = toQuestions(block.questions);
      for (const [index, question] of blockQuestions.entries()) {
        const key = `block::${blockKey(phase.slug, block, order)}::${index}`;
        seenQuestionKeys.add(key);

        await prisma.interviewQuestion.upsert({
          where: { key },
          create: {
            key,
            text: question.text,
            modelAnswer: question.answer || null,
            topicId: null,
            phaseId: null,
            groupId: null,
            practiceBlockId: null,
            difficulty: "INTERMEDIATE",
            tagsJson: toTags(`${block.title ?? "Practice"} ${phase.slug}`),
            phaseOrder: phase.order,
          },
          update: {
            text: question.text,
            modelAnswer: question.answer || null,
            tagsJson: toTags(`${block.title ?? "Practice"} ${phase.slug}`),
            phaseOrder: phase.order,
          },
        });

        questionCount += 1;
        if (question.answer) questionsWithAnswers += 1;
      }
    }
  }

  // Link block-authored questions to their block and phase. Their key carries
  // the block key, so the join is a lookup rather than a stored back-reference.
  const blockRows = await prisma.practiceBlock.findMany({
    select: { id: true, key: true, phaseId: true },
  });
  const blockIdByKey = new Map(blockRows.map((row) => [row.key, row]));

  const orphanBlockQuestions = await prisma.interviewQuestion.findMany({
    where: { practiceBlockId: null, key: { startsWith: "block::" } },
    select: { id: true, key: true, phaseId: true },
  });

  for (const question of orphanBlockQuestions) {
    const blockKeyFromQuestion = question.key.split("::").slice(1, -1).join("::");
    const block = blockIdByKey.get(blockKeyFromQuestion);
    if (!block) continue;
    await prisma.interviewQuestion.update({
      where: { id: question.id },
      data: {
        practiceBlockId: block.id,
        phaseId: block.phaseId,
        groupId: null,
        topicId: null,
      },
    });
  }

  // ── Prune content that no longer exists in the source ────────
  // Re-parsing edited source text can remove or rename a block. Leaving those
  // rows behind would show a candidate material that is not in their file, so
  // rows whose key was not written this run are removed. Candidate-owned rows
  // (attempts, drill results) cascade with them, which is correct: a removed
  // question cannot be answered.
  const staleQuestions = await prisma.interviewQuestion.findMany({
    where: { key: { notIn: Array.from(seenQuestionKeys) } },
    select: { id: true },
  });
  if (staleQuestions.length > 0) {
    await prisma.interviewQuestion.deleteMany({
      where: { id: { in: staleQuestions.map((row) => row.id) } },
    });
  }

  const staleBlocks = await prisma.practiceBlock.findMany({
    where: { key: { notIn: Array.from(seenBlockKeys) } },
    select: { id: true },
  });
  if (staleBlocks.length > 0) {
    await prisma.practiceBlock.deleteMany({
      where: { id: { in: staleBlocks.map((row) => row.id) } },
    });
  }

  return {
    questionCount,
    questionsWithAnswers,
    blockCount,
    blockItemCount,
    prunedQuestions: staleQuestions.length,
    prunedBlocks: staleBlocks.length,
  };
}
