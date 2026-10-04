/**
 * Checks a source file for byte-level corruption: replacement characters,
 * lone surrogates, and non-ASCII bytes that indicate the file was re-encoded
 * by a tool that does not understand UTF-8.
 *
 * Usage: node scripts/check-encoding.mjs <file>
 */

import { readFileSync } from "node:fs";

const file = process.argv[2];
const buffer = readFileSync(file);
const text = buffer.toString("utf8");

console.log(`File:   ${file}`);
console.log(`Bytes:  ${buffer.length}`);

// U+FFFD is what a decoder emits for bytes it cannot read.
const replacement = text.indexOf("\uFFFD");
console.log(`U+FFFD replacement chars: ${replacement === -1 ? "none" : replacement}`);

const nonAscii = [...text].filter((character) => character.codePointAt(0) > 127);
console.log(`Non-ASCII characters: ${nonAscii.length}`);

const unique = new Map();
for (const character of nonAscii) {
  const code = character.codePointAt(0);
  const key = `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
  unique.set(key, (unique.get(key) ?? 0) + 1);
}
console.log(`Distinct non-ASCII code points: ${unique.size}`);
for (const [key, count] of [...unique.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) {
  console.log(`  ${key}  x${count}`);
}

// A UTF-8 encoded box-drawing character is three bytes; if a tool re-encoded
// the file as latin-1 you get a different spread of high bytes.
const highBytes = buffer.filter((byte) => byte > 127).length;
console.log(`High (>0x7f) bytes: ${highBytes}`);

if (replacement !== -1) {
  const start = Math.max(0, replacement - 60);
  console.log(`\nFirst replacement char context:\n  ${JSON.stringify(text.slice(start, replacement + 60))}`);
}
