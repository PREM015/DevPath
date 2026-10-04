/**
 * Generates src/content/phase-outlines.ts from prisma/seed-data.
 *
 * The landing page needs roadmap shape (phase names, group counts, topic counts)
 * without a database round trip on every request. This writes that shape as a
 * typed module so the page can never drift from what the seed actually loads.
 *
 * It also carries the interview counts, so the marketing page can state how many
 * questions and drills exist rather than implying a number it has not checked.
 *
 * Usage: node scripts/generate-outline.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const seedDataDir = join(projectRoot, "prisma", "seed-data");
const outFile = join(projectRoot, "src", "content", "phase-outlines.ts");

const phases = [];
let totalGroups = 0;
let totalTopics = 0;
let totalQuestions = 0;
let totalAnsweredQuestions = 0;
let totalBlocks = 0;

for (let i = 1; i <= 15; i += 1) {
  const file = join(seedDataDir, `phase-${String(i).padStart(2, "0")}.json`);
  const phase = JSON.parse(readFileSync(file, "utf8"));

  // Interview content is authored per topic. A topic counts as "deep" only when
  // the parser recovered its body, not merely its title from the outline.
  let deepTopics = 0;
  let questions = 0;
  let answered = 0;
  for (const group of phase.groups) {
    for (const topic of group.topics) {
      const topicQuestions = topic.interviewQuestions ?? [];
      questions += topicQuestions.length;
      answered += topicQuestions.filter((question) => question?.answer).length;
      if (topic.interview && Object.keys(topic.interview).length > 0) deepTopics += 1;
    }
  }

  const practice = phase.practice ?? [];
  const blockItems = practice.reduce((sum, block) => sum + (block.items?.length ?? 0), 0);

  // Rapid-fire sets and Q&A banks are authored inside a practice block, so their
  // questions live on the block, not on a topic. Both sets reach the bank, so
  // both must be counted here or the landing page understates it.
  const blockQuestions = practice.reduce(
    (sum, block) => sum + (block.questions?.length ?? 0),
    0,
  );
  const blockAnswered = practice.reduce(
    (sum, block) =>
      sum + (block.questions ?? []).filter((question) => question?.answer).length,
    0,
  );
  questions += blockQuestions;
  answered += blockAnswered;

  totalGroups += phase.groups.length;
  totalTopics += phase.groups.reduce((sum, group) => sum + group.topics.length, 0);
  totalQuestions += questions;
  totalAnsweredQuestions += answered;
  totalBlocks += practice.length;

  phases.push({
    order: phase.order,
    title: phase.title,
    icon: phase.icon ?? "📘",
    color: phase.color,
    difficulty: phase.difficulty,
    summary: phase.description,
    topics: phase.groups.reduce((sum, group) => sum + group.topics.length, 0),
    groups: phase.groups.map((group) => group.title),
    deepTopics,
    questions,
    answeredQuestions: answered,
    practiceBlocks: practice.length,
    practiceItems: blockItems,
  });
}

const body = phases
  .map(
    (phase) =>
      `export const PHASE_${phase.order}_OUTLINE: PhaseOutlineEntry = ${JSON.stringify(phase, null, 2)};`,
  )
  .join("\n\n");

const header = `/**
 * Static roadmap outline for the landing page.
 *
 * GENERATED FILE — do not edit by hand. Regenerate with:
 *   node scripts/generate-outline.mjs
 *
 * Holds roadmap SHAPE and interview COUNTS only, so the marketing page needs no
 * database round trip. The interactive roadmap always reads live content from the
 * database, so this file can never be the source of truth for a learner.
 *
 * Regenerate after every content sync so the numbers below stay honest.
 */

import type { PhaseOutlineEntry } from "@/features/roadmap/phase-outline-data";

`;

const totals = `/** Totals across all phases, from the same source as the entries above. */
export const CONTENT_TOTALS = ${JSON.stringify(
  {
    phases: phases.length,
    groups: totalGroups,
    topics: totalTopics,
    deepTopics: phases.reduce((sum, phase) => sum + phase.deepTopics, 0),
    questions: totalQuestions,
    answeredQuestions: totalAnsweredQuestions,
    practiceBlocks: totalBlocks,
    practiceItems: phases.reduce((sum, phase) => sum + phase.practiceItems, 0),
  },
  null,
  2,
)} as const;

`;

mkdirSync(dirname(outFile), { recursive: true });
writeFileSync(outFile, `${header}${body}\n${totals}`, "utf8");

console.log(
  `Wrote src/content/phase-outlines.ts — ${phases.length} phases, ${totalGroups} groups, ` +
    `${totalTopics} topics, ${totalQuestions} questions (${totalAnsweredQuestions} answered), ` +
    `${totalBlocks} practice blocks.`,
);