/**
 * Bisects a source file to find the line where `node --check` starts failing.
 *
 * A syntax error caused by an unterminated literal is reported at an arbitrary
 * later line, so the reported line number is not where the fix belongs. This
 * finds the smallest prefix that fails, which is where the real problem is.
 *
 * Usage: node scripts/bisect-syntax.mjs <file>
 */

import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? join(here, "parse-roadmap.mjs");

const lines = readFileSync(file, "utf8").split(/\r?\n/);
const dir = mkdtempSync(join(tmpdir(), "bisect-"));
const scratch = join(dir, "probe.mjs");

function failsAt(lineCount) {
  writeFileSync(scratch, lines.slice(0, lineCount).join("\n"), "utf8");
  try {
    execFileSync(process.execPath, ["--check", scratch], { stdio: "ignore" });
    return false;
  } catch {
    return true;
  }
}

if (!failsAt(lines.length)) {
  console.log("File parses cleanly.");
} else {
  // Binary search for the smallest failing prefix.
  let low = 1;
  let high = lines.length;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (failsAt(mid)) high = mid;
    else low = mid + 1;
  }

  console.log(`Smallest failing prefix ends at line ${low}.`);
  console.log("That line is the first to be included while the file still fails,");
  console.log("so the break is in it or in the few lines above it.\n");
  for (let i = Math.max(0, low - 8); i < Math.min(lines.length, low + 4); i += 1) {
    console.log(`${i + 1}: ${lines[i]}`);
  }
}

rmSync(dir, { recursive: true, force: true });
