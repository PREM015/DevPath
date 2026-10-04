/**
 * Focused check of the section parser against the field shapes that actually
 * appear in the roadmap documents.
 *
 * Run: node scripts/test-parse-section.mjs
 */

import { parseSection } from "./lib/parse-section.mjs";

let passed = 0;
let failed = 0;

function check(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\nSection parser\n");

// ── A technical topic with the full label set ────────────────────
const technical = parseSection([
  "**Definition:** The full sequence from pressing Enter to seeing a page.",
  "",
  "**Why interviewers ask:** It's the most common warm-up question. It tests whether you",
  "understand the whole stack and lets the interviewer probe any layer.",
  "",
  "**What they evaluate:** depth of the stack walk-through, and where you stop being vague.",
  "",
  "**Key concepts**",
  "- Browser and URL parsing",
  "- DNS resolution",
  "- TCP and TLS handshake",
  "",
  "**Common questions**",
  "1. What happens when you type a URL?",
  "2. What is the difference between a cookie and localStorage? *(cookies go to the server)*",
  "3. Why is a hash not encryption?",
  "",
  '**Model answer, Q1:** "Parse, resolve DNS, open a TCP connection, negotiate TLS, send HTTP.',
  'The server responds and the browser builds the DOM."',
  "**Model answer, Q2:** \"Cookies are sent on matching requests; localStorage is not.\"",
  "",
  "**Say out loud:** Start at the browser, then the network, then the server.",
  "",
  "**Probe:** ask what changes if DNS is cached.",
  "",
  "**Common wrong answers**",
  "- Saying the browser goes straight to the IP address",
  "",
  "**Common mistakes**",
  "- Skipping TLS entirely",
  "",
  "**Mini task:** Explain the whole flow out loud in under two minutes.",
  "",
  "**Self-check:** Can you name every layer in order?",
  "",
  "**Prerequisites:** How the web works.",
  "",
  "```text",
  "browser -> DNS -> TCP -> TLS -> HTTP",
  "```",
]);

check("captures the definition", technical.definition.startsWith("The full sequence"), technical.definition);
check("captures why interviewers ask", technical.whyAsked.startsWith("It's the most common"), technical.whyAsked);
check("captures the evaluation rubric", technical.evaluation.length === 1 && technical.evaluation[0].includes("depth of the stack"), JSON.stringify(technical.evaluation));
check("captures key concepts", technical.keyConcepts.length === 3, JSON.stringify(technical.keyConcepts));
check("prerequisites do not leak into concepts", !technical.keyConcepts.some((c) => c.toLowerCase().startsWith("prereq")), JSON.stringify(technical.keyConcepts));
check("captures three questions", technical.questions.length === 3, `${technical.questions.length}`);
check("numbers the questions", technical.questions[0].number === 1, JSON.stringify(technical.questions[0]));
check("captures the inline answer on Q2", technical.questions[1].answer === "cookies go to the server", JSON.stringify(technical.questions[1]));
check("attaches model answer to Q1", technical.questions[0].answer.includes("Parse, resolve DNS"), JSON.stringify(technical.questions[0]));
check("an inline answer is not overwritten by a model answer", technical.questions[1].answer === "cookies go to the server", JSON.stringify(technical.questions[1]));
check("leaves Q3 without an invented answer", technical.questions[2].answer === "", JSON.stringify(technical.questions[2]));
check("captures say-out-loud", technical.sayOutLoud.includes("Start at the browser"), technical.sayOutLoud);
check("captures the probe", technical.probe.length === 1 && technical.probe[0].includes("DNS is cached"), JSON.stringify(technical.probe));
check("captures common wrong answers", technical.wrongAnswers.length === 1, JSON.stringify(technical.wrongAnswers));
check("captures mistakes separately from wrong answers", technical.mistakes.length === 1 && technical.mistakes[0].includes("Skipping TLS"), JSON.stringify(technical.mistakes));
check("captures the mini task", technical.practice.some((p) => p.includes("two minutes")), JSON.stringify(technical.practice));
check("captures the self-check", technical.selfCheck.length === 1, JSON.stringify(technical.selfCheck));
check("captures prerequisites", technical.prerequisites.length === 1, JSON.stringify(technical.prerequisites));
check("preserves the code fence as reference", technical.__reference.includes("browser -> DNS"), technical.__reference.slice(0, 60));
check("code fence does not leak into concepts", !technical.keyConcepts.some((c) => c.includes("browser -> DNS")));

// ── The debugging-runbook archetype used in expand.md ─────────────
const debugging = parseSection([
  "**Definition:** Intermittent 502 from the gateway.",
  "",
  "**Symptom.** Roughly 1% of POST /orders returns 502.",
  "",
  "**Investigation.**",
  "- Correlate with p99 latency",
  "- Compare deploy timestamps",
  "",
  "**Root cause:** connection pool exhaustion during rolling deploys.",
  "",
  "**Fix.** Drain connections before the old pod exits.",
  "",
  "**Prevention.** Readiness gate on drain completion.",
  "",
  "**Tools:** ingress logs, pprof, APM trace waterfall.",
  "",
  "**Interview signal.** Distinguishing pool exhaustion from a slow query.",
  "",
  "**Mini task:** Write the runbook for this failure mode.",
]);

check("debug: captures symptoms", debugging.symptoms.length >= 1, JSON.stringify(debugging.symptoms));
check("debug: captures investigation steps", debugging.investigation.length === 2, JSON.stringify(debugging.investigation));
check("debug: captures root cause", debugging.rootCause.length === 1 && debugging.rootCause[0].includes("pool exhaustion"), JSON.stringify(debugging.rootCause));
check("debug: captures the fix", debugging.fix.length >= 1, JSON.stringify(debugging.fix));
check("debug: captures prevention", debugging.prevention.length >= 1, JSON.stringify(debugging.prevention));
check("debug: captures tools", debugging.tools.length >= 1, JSON.stringify(debugging.tools));
check("debug: captures the interview signal", debugging.interviewSignal.includes("pool exhaustion"), debugging.interviewSignal);

// ── A topic with no labels at all (bold sub-headings only) ───────
const bare = parseSection([
  "**The box model:** every element is content, padding, border, margin.",
  "- `box-sizing: border-box` makes width predictable.",
  "- Margin collapsing combines adjacent vertical margins.",
  "",
  "**Hiding techniques**",
  "",
  "| Technique | Layout space |",
  "|---|---|",
  "| `display: none` | Removed |",
]);

check("bare topic still yields concepts", bare.keyConcepts.length >= 3, JSON.stringify(bare.keyConcepts));
check("bare topic keeps the table out of concepts", !bare.keyConcepts.some((c) => c.includes("|---|")));

// ── Nothing is invented for a section with no content ─────────────
const empty = parseSection([]);
check("empty section yields no questions", empty.questions.length === 0);
check("empty section yields no model answers", empty.modelAnswer.length === 0);
check("empty section yields no definition", empty.definition === "");

console.log(`\n${"─".repeat(50)}`);
console.log(`Passed: ${passed}   Failed: ${failed}`);
console.log("");

if (failed > 0) process.exitCode = 1;
