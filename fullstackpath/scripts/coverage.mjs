/**
 * Coverage report: what interview content exists per phase, and what is missing.
 *
 * The point is to make the next expand.md batch obvious. It answers three
 * questions per phase:
 *
 *   1. How many topics exist, and how many have real interview content
 *      (questions, a rubric, a spoken answer) versus being a bare title.
 *   2. How many questions exist, and how many carry a model answer.
 *   3. How many practice blocks exist, by kind.
 *
 * Phases with zero expanded content are the ones worth writing next, so they are
 * called out explicitly at the top.
 *
 * Usage:
 *   node scripts/coverage.mjs            # report on the seeded database
 *   node scripts/coverage.mjs --json     # machine-readable, for CI
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.ts";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");

// Load .env.local so the report runs with no extra shell setup.
for (const file of [".env", ".env.local"]) {
  try {
    for (const line of readFileSync(join(projectRoot, file), "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (process.env[match[1]] === undefined) process.env[match[1]] = value;
    }
  } catch {
    // Missing file is fine when the variables are already exported.
  }
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 2 }),
});

function readManifest() {
  try {
    return JSON.parse(readFileSync(join(projectRoot, "prisma", "seed-data", "manifest.json"), "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const asJson = process.argv.includes("--json");
  const manifest = readManifest();

  const phases = await prisma.phase.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      order: true,
      title: true,
      _count: { select: { questions: { where: { isActive: true } }, practiceBlocks: true } },
    },
  });

  // Per-phase interview content. The question counts come from the shared bank;
  // the "deep" counts come from the topic payload.
  const [topicRows, answeredByPhase, blockRows] = await Promise.all([
    prisma.topic.findMany({
      where: { isActive: true, group: { phaseId: { in: phases.map((p) => p.id) } } },
      select: {
        group: { select: { phaseId: true } },
        interviewJson: true,
        interviewQsJson: true,
        referenceMarkdown: true,
        troubleshootingJson: true,
      },
    }),
    prisma.interviewQuestion.groupBy({
      by: ["phaseId"],
      where: { isActive: true, modelAnswer: { not: null } },
      _count: { _all: true },
    }),
    prisma.practiceBlock.findMany({
      select: { phaseId: true, kind: true, itemsJson: true },
    }),
  ]);

  const answeredMap = new Map(answeredByPhase.map((row) => [row.phaseId, row._count._all]));

  const report = phases.map((phase) => {
    const topics = topicRows.filter((row) => row.group.phaseId === phase.id);

    const withQuestions = topics.filter(
      (row) => Array.isArray(row.interviewQsJson) && row.interviewQsJson.length > 0,
    ).length;
    const withInterviewPayload = topics.filter((row) => row.interviewJson !== null).length;
    const withReference = topics.filter((row) => row.referenceMarkdown !== null).length;
    const withRunbook = topics.filter((row) => row.troubleshootingJson !== null).length;

    const blocks = blockRows.filter((row) => row.phaseId === phase.id);
    const byKind = {};
    let blockItems = 0;
    for (const block of blocks) {
      byKind[block.kind] = (byKind[block.kind] ?? 0) + 1;
      blockItems += Array.isArray(block.itemsJson) ? block.itemsJson.length : 0;
    }

    return {
      order: phase.order,
      title: phase.title,
      topics: topics.length,
      topicsWithQuestions: withQuestions,
      topicsWithInterviewPayload: withInterviewPayload,
      topicsWithReference: withReference,
      topicsWithRunbook: withRunbook,
      questions: phase._count.questions,
      questionsWithAnswers: answeredMap.get(phase.id) ?? 0,
      practiceBlocks: blocks.length,
      practiceItems: blockItems,
      byKind,
      /** A phase is "bare" when it has topics but no authored interview content. */
      bare: withInterviewPayload === 0 && phase._count.questions === 0 && blocks.length === 0,
    };
  });

  if (asJson) {
    console.log(JSON.stringify({ manifest, phases: report }, null, 2));
    return;
  }

  const totals = report.reduce(
    (sum, phase) => ({
      topics: sum.topics + phase.topics,
      topicsWithInterviewPayload: sum.topicsWithInterviewPayload + phase.topicsWithInterviewPayload,
      questions: sum.questions + phase.questions,
      questionsWithAnswers: sum.questionsWithAnswers + phase.questionsWithAnswers,
      practiceBlocks: sum.practiceBlocks + phase.practiceBlocks,
      practiceItems: sum.practiceItems + phase.practiceItems,
    }),
    {
      topics: 0,
      topicsWithInterviewPayload: 0,
      questions: 0,
      questionsWithAnswers: 0,
      practiceBlocks: 0,
      practiceItems: 0,
    },
  );

  const bare = report.filter((phase) => phase.bare);

  console.log("\nInterview content coverage\n" + "=".repeat(78));
  if (manifest) {
    console.log(
      `Sources: ${[manifest.structureSource, ...(manifest.contentSources ?? [])].join(", ")}`,
    );
  }
  console.log("");

  console.log(
    "Phase".padEnd(34) +
      "Topics".padStart(8) +
      "Deep".padStart(7) +
      "Quest".padStart(8) +
      "Ans".padStart(7) +
      "Blocks".padStart(8),
  );
  console.log("-".repeat(78));

  for (const phase of report) {
    console.log(
      `${String(phase.order).padStart(2)}. ${phase.title.slice(0, 30).padEnd(31)}` +
        String(phase.topics).padStart(8) +
        String(phase.topicsWithInterviewPayload).padStart(7) +
        String(phase.questions).padStart(8) +
        String(phase.questionsWithAnswers).padStart(7) +
        String(phase.practiceBlocks).padStart(8),
    );
  }

  console.log("-".repeat(78));
  console.log(
    "TOTAL".padEnd(34) +
      String(totals.topics).padStart(8) +
      String(totals.topicsWithInterviewPayload).padStart(7) +
      String(totals.questions).padStart(8) +
      String(totals.questionsWithAnswers).padStart(7) +
      String(totals.practiceBlocks).padStart(8),
  );

  console.log("");
  console.log(`Legend: Topics = in roadmap · Deep = have interview payload · Quest = questions · Ans = with a model answer`);

  if (bare.length > 0) {
    console.log("");
    console.log(`NEXT BATCH: ${bare.length} phase(s) have structure but no authored content`);
    for (const phase of bare) {
      console.log(`  - Phase ${phase.order}: ${phase.title} (${phase.topics} topics waiting)`);
    }
  } else {
    console.log("");
    console.log("Every phase has some authored interview content.");
  }

  // Where the thinnest model-answer coverage is, so effort goes where it pays.
  const thin = report
    .filter((phase) => phase.questions > 0)
    .map((phase) => ({
      ...phase,
      ratio: phase.questions > 0 ? phase.questionsWithAnswers / phase.questions : 0,
    }))
    .filter((phase) => phase.ratio < 0.5)
    .sort((a, b) => a.ratio - b.ratio);

  if (thin.length > 0) {
    console.log("");
    console.log("Model-answer coverage below 50% (highest value to fill next):");
    for (const phase of thin.slice(0, 6)) {
      console.log(
        `  - Phase ${phase.order}: ${phase.questionsWithAnswers}/${phase.questions} ` +
          `(${(phase.ratio * 100).toFixed(0)}%)`,
      );
    }
  }

  console.log("");
}

main()
  .catch((error) => {
    console.error("Coverage report failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
