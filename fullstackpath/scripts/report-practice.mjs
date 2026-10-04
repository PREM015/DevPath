/**
 * Diagnostic: how many practice blocks (drills, scenarios, rapid-fire, Q&A,
 * machine-coding, checklists) sit in each source, and which of them cannot be
 * placed on a phase because they appear before any numbered topic.
 *
 * Usage: node scripts/report-practice.mjs
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");

const SOURCES = [
  join(projectRoot, "..", "# Complete Full Stack Interview Roa.txt"),
  join(projectRoot, "..", "expand.md"),
];

const ARCHETYPES = [
  [/^drill\b/i, "drill"],
  [/^scenario\b/i, "scenario"],
  [/rapid[\s-]?fire/i, "rapidfire"],
  [/\bq\s*&\s*a\b|interview q\s*&\s*a|interview questions\b/i, "qa"],
  [/machine[\s-?\\]?coding|machine[\s-?\\]?problem/i, "machineCoding"],
  [/readiness checklist|final checklist|final readiness/i, "checklist"],
  [/ledger|cheat ?sheet|interview kit/i, "reference"],
];

function archetypeOf(title) {
  for (const [pattern, kind] of ARCHETYPES) {
    if (pattern.test(title)) return kind;
  }
  return null;
}

let grandTotal = 0;
let grandUnplaced = 0;

for (const path of SOURCES) {
  let lines;
  try {
    lines = readFileSync(path, "utf8").split(/\r?\n/);
  } catch {
    console.log(`(skipped: ${path})`);
    continue;
  }

  let inFence = false;
  let lastNumber = null;
  const byKind = new Map();
  const unplaced = [];

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (!match) continue;

    const numbers = (match[2].match(/^\s*(\d+)\.(\d+)\.(\d+)/) ?? []).slice(1);

    if (numbers.length === 3) {
      lastNumber = numbers.map(Number);
      continue;
    }

    const kind = archetypeOf(match[2]);
    if (!kind) continue;

    byKind.set(kind, (byKind.get(kind) ?? 0) + 1);
    grandTotal += 1;

    if (!lastNumber) {
      unplaced.push({ kind, title: match[2].trim().slice(0, 70) });
      grandUnplaced += 1;
    }
  }

  console.log(`\n${path.split(/[\\/]/).pop()}`);
  console.log(`  practice blocks: ${grandTotal - (byKind.size ? 0 : 0)} total in this file`);
  for (const [kind, count] of [...byKind.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${String(count).padStart(4)}  ${kind}`);
  }
  console.log(`  blocks before any numbered topic (unplaceable): ${unplaced.length}`);
  for (const item of unplaced.slice(0, 20)) {
    console.log(`    - [${item.kind}] ${item.title}`);
  }
}

console.log(`\nTotal practice blocks: ${grandTotal}, unplaceable: ${grandUnplaced}`);

// What the seed data currently holds.
console.log("\nCurrently in seed data:");
const seedDir = join(projectRoot, "prisma", "seed-data");
let blocks = 0;
let items = 0;
for (const file of readdirSync(seedDir).filter((f) => /^phase-\d+\.json$/.test(f))) {
  const phase = JSON.parse(readFileSync(join(seedDir, file), "utf8"));
  blocks += (phase.practice ?? []).length;
  for (const block of phase.practice ?? []) items += block.items.length;
}
console.log(`  ${blocks} blocks attached, ${items} items`);
