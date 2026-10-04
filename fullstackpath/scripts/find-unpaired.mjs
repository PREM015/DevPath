/**
 * Finds unpaired backticks and quotes, which is what an unterminated template
 * literal looks like from the parser's point of view: the reported error lands
 * at the NEXT backtick, far from the real cause.
 *
 * Regex literals are skipped so that patterns like /`/g are not miscounted.
 *
 * Usage: node scripts/find-unpaired.mjs <file>
 */

import { readFileSync } from "node:fs";

const file = process.argv[2];
const lines = readFileSync(file, "utf8").split(/\r?\n/);

/** Replaces string/template/regex literals with spaces, preserving length. */
function blankLiterals(line) {
  const out = line.split("");
  let i = 0;

  while (i < line.length) {
    const character = line[i];

    if (character === "/" && line[i + 1] === "/") {
      // Line comment.
      for (let j = i; j < line.length; j += 1) out[j] = " ";
      break;
    }

    if (character === "/" && line[i + 1] === "*") {
      for (let j = i; j < line.length - 1; j += 1) out[j] = " ";
      i += 1;
      continue;
    }

    if (character === '"' || character === "'" || character === "`") {
      const quote = character;
      let j = i + 1;
      while (j < line.length) {
        if (line[j] === "\\") {
          j += 2;
          continue;
        }
        if (line[j] === quote) break;
        j += 1;
      }
      const closed = j < line.length;
      for (let k = i; k <= Math.min(j, line.length - 1); k += 1) {
        if (k !== i && line[k] !== "\\") out[k] = " ";
      }
      if (closed) {
        for (let k = i; k <= j; k += 1) out[k] = " ";
        i = j + 1;
        continue;
      }
      // Unterminated on this line. A template literal may legitimately span
      // lines, so only report if no closing backtick appears on a later line.
      if (quote === "`") {
        const laterCloses = lines.slice(lines.indexOf(line) + 1).some((l) => l.includes("`"));
        if (laterCloses) {
          i = line.length;
          continue;
        }
      }
      console.log(`UNTERMINATED ${quote === "`" ? "template literal" : "string"} at line ${lines.indexOf(line) + 1}:`);
      console.log(`  ${line.trim()}`);
      process.exitCode = 1;
      return;
    }

    i += 1;
  }

  return out.join("");
}

for (let index = 0; index < lines.length; index += 1) {
  blankLiterals(lines[index]);
}

console.log("All string and template literals are balanced.");
