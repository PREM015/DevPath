/**
 * Locates the first line where the parser loses bracket balance, which is how an
 * unterminated string or regex shows up as a syntax error far away from its cause.
 *
 * Usage: node scripts/find-syntax-break.mjs
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? join(here, "parse-roadmap.mjs");

const lines = readFileSync(file, "utf8").split(/\r?\n/);

const balance = { "{": 0, "(": 0, "[": 0 };
const closers = { "}": "{", ")": "(", "]": "[" };

let inBlockComment = false;
const suspicious = [];

for (let i = 0; i < lines.length; i += 1) {
  const raw = lines[i];
  let line = raw;

  if (inBlockComment) {
    if (line.includes("*/")) inBlockComment = false;
    continue;
  }
  if (line.includes("/*") && !line.includes("*/")) {
    inBlockComment = true;
    continue;
  }

  // Remove string and template literals, then comments.
  line = line.replace(/'(?:\\.|[^'\\])*'/g, "");
  line = line.replace(/"(?:\\.|[^"\\])*"/g, "");
  line = line.replace(/`(?:\\.|[^`\\])*`/g, "");
  line = line.replace(/\/\/.*$/, "");

  for (const character of line) {
    if (balance[character] !== undefined) balance[character] += 1;
    else if (closers[character]) balance[closers[character]] -= 1;
  }

  const negative =
    balance["{"] < 0 || balance["("] < 0 || balance["["] < 0;

  if (negative) {
    suspicious.push({ line: i + 1, text: raw.trim().slice(0, 90), balance: { ...balance } });
    break;
  }
}

if (suspicious.length === 0) {
  console.log("No bracket imbalance detected. Final balance:", balance);
} else {
  const item = suspicious[0];
  console.log(`First imbalance at line ${item.line}:`);
  console.log(`  ${item.text}`);
  console.log("  balance:", item.balance);
  console.log("\n  Context:");
  for (let i = Math.max(0, item.line - 8); i < Math.min(lines.length, item.line + 3); i += 1) {
    console.log(`  ${i + 1}: ${lines[i]}`);
  }
}
