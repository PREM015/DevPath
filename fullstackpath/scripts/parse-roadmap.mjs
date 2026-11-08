/**
 * Parses the canonical roadmap source document into structured seed data.
 *
 * The source document has two parts:
 *
 *   Part 1  a condensed roadmap: 15 phases, each with groups, each with a
 *           comma-separated topic list. This defines the STRUCTURE.
 *   Part 2  an expanded edition: one section per topic, with the sections
 *           labelled `Definition`, `Why it matters`, `Key concepts`,
 *           `Common mistakes`, `Mini task` and `Self-check`. This supplies the
 *           CONTENT.
 *
 * Topics are matched between the two parts by normalised title, so a topic in
 * Part 1 with no matching Part 2 section keeps its structural entry (and says so)
 * rather than being dropped. Nothing is truncated or summarised away.
 *
 * Output: prisma/seed-data/phases-01.json .. phases-15.json
 *
 * Usage: node scripts/parse-roadmap.mjs "<structure file>" ["<expanded file>"]
 *
 * The expanded content is split across two documents in this project: the main
 * roadmap file carries the expanded sections for phases 1-3, and expand.md
 * carries phases 4-15. Both are optional and are merged into one lookup, with the
 * first file winning on conflicts.
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSection } from "./lib/parse-section.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const outDir = join(projectRoot, "prisma", "seed-data");

/**
 * The roadmap structure file. It has been published as both `.txt` and `.md`
 * over the life of the project, so resolve whichever exists rather than failing
 * with ENOENT when someone renames or re-exports it.
 */
function resolveStructurePath() {
  if (process.argv[2]) return process.argv[2];
  const base = join(projectRoot, "..", "# Complete Full Stack Interview Roa");
  for (const candidate of [`${base}.md`, `${base}.txt`]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

const structurePath = resolveStructurePath();
const phaseDir = join(projectRoot, "..", "phase");

/**
 * Content sources.
 *
 * The standalone outline and `expand.md` were folded into ../phase by hand: the
 * cross-cutting tracks and interview kit became `00-roadmap-spine.md` and each
 * per-phase deep dive absorbed the parts of `expand.md` that belonged to it. So
 * ../phase is now the only authoritative input, and the outline is optional
 * rather than required. Files load in name order - the spine first, then the
 * fifteen phases - and are appended rather than replacing one another, so
 * nothing already ingested is dropped: a section is matched to a roadmap topic
 * by title where one exists and adopted as a new topic where one does not.
 */
const expandedPaths = process.argv.slice(3);
if (expandedPaths.length === 0) {
  if (existsSync(phaseDir)) {
    const perPhase = readdirSync(phaseDir)
      .filter((name) => /^\d{2}.*\.md$/.test(name))
      .sort();
    for (const name of perPhase) expandedPaths.push(join(phaseDir, name));
  }
  for (const candidate of [resolveStructurePath(), join(projectRoot, "..", "expand.md")]) {
    if (candidate && existsSync(candidate)) expandedPaths.push(candidate);
  }
}

import {
  DIFFICULTY_NAME,
  groupDifficultyFor,
  phaseDifficultyFor,
} from "./lib/difficulty.mjs";

const MARKERS = { "\u2705": "original", "\u2795": "added", "\u{1F195}": "new" };

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function slugify(text) {
  return text
    .normalize("NFKD")
    // Strip markdown code fences first: `debounce` and debounce must not produce
    // two different slugs for the same topic.
    .replace(/`/g, "")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Key used to match a Part 1 topic to a Part 2 section heading. */
function normalizeKey(text) {
  return text
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Strips emoji and the source document's legend markers from a heading so the
 * title a learner sees is plain text.
 */
function stripEmoji(text) {
  return text
    // Pictographs, symbols and variation selectors.
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{1F1E6}-\u{1F1FF}\u{2B50}-\u{2B55}]/gu, "")
    // The legend markers used throughout the source document.
    .replace(/[\u{1F195}\u{2795}\u{2705}]/gu, "")
    // Collapse whitespace and remove brackets left empty by the removals above.
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:])/g, "$1")
    .trim();
}

/** Splits a Part 1 topic bullet into individual topic titles. */
function splitTopics(line) {
    // Strip the list marker first. Without this the first topic keeps its `- `
    // and renders as "- Singleton" in the UI.
    const body = line.replace(/^\s*[-*]\s+/, "");

    // Split on commas at paren depth zero only. A naive split breaks
    // "LLM API integration (OpenAI, Anthropic, etc.)" into three nonsense
    // topics, two of which are fragments.
    const parts = [];
    let depth = 0;
    let buffer = "";
    for (const ch of body) {
      if (ch === "(" || ch === "[" || ch === "{") depth += 1;
      else if (ch === ")" || ch === "]" || ch === "}") depth = Math.max(0, depth - 1);

      if (ch === "," && depth === 0) {
        parts.push(buffer);
        buffer = "";
      } else {
        buffer += ch;
      }
    }
    parts.push(buffer);

    return parts
      .map((part) =>
        stripEmoji(
          part
            .replace(/✅/g, "")
            .replace(/➕/g, "")
            .replace(/🆕/g, "")
            .replace(/\*\*/g, "")
            .replace(/`/g, "")
            .replace(/\s+/g, " ")
            .trim(),
        ),
      )
      // A leading bullet or an orphaned closing bracket means the split landed
      // inside a parenthetical; that fragment is not a topic.
      .filter(
        (title) =>
          title.length > 0 &&
          title.length < 120 &&
          !/^[-–—]/.test(title) &&
          !/^[)\]}.,;]/.test(title),
      );
  }

function markerOf(line) {
  for (const [mark, kind] of Object.entries(MARKERS)) {
    if (line.includes(mark)) return kind;
  }
  return "original";
}

/** Strips inline bold and code markers from a heading. */
function cleanHeading(text) {
  return stripEmoji(
    text
      .replace(/^\s*[\d.]+\s*/, "")
      // Cross-cutting chapters are numbered `X.1.1`.
      .replace(/^\s*[A-Za-z](?:\.\d+)+\s+/, "")
      .replace(/\*\*/g, "")
      .replace(/`/g, "")
      .replace(/\(\s*\)\s*$/, "")
      .trim(),
  )
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

// ─────────────────────────────────────────────
// Part 1: structure
// ─────────────────────────────────────────────

const CROSS_CUTTING_ORDER = 16;
const CROSS_CUTTING_TITLE = "Cross-cutting Tracks and the Final Interview Kit";
const KIT_GROUP_ORDER = 5;

/**
 * Classifies a heading by its numbering rather than by how many hashes precede
 * it.
 *
 * The per-phase files are not consistent about depth. 01.md declares a topic as
 * `### 1.1.3`, while 02.md and 06.md declare the same two levels as `# 2.1` and
 * `## 2.1.1`. Keying off depth therefore read three quarters of Phase 2 and
 * Phase 6 as groups and captured none of their chapters as topics, which is
 * where most of the missing coverage was.
 *
 * A space is required after the number so `3.5GHz` is not read as a group.
 * `X.*` is the cross-cutting layer - projects, learning paths, role and level
 * tracks - and `K.*` the final interview kit; both belong to Phase 16.
 *
 * Returns null for a heading that is not part of the numbered skeleton.
 */
function classifyHeading(text) {
  const phaseHead = text.match(/^PHASE\s+(\d+)\b(?:\s*,?\s*PART\s*\d+)?\s*:?\s*(.*)$/i);
  if (phaseHead) {
    return {
      kind: "phase",
      phaseOrder: Number(phaseHead[1]),
      groupOrder: null,
      topicOrder: null,
      title: stripEmoji(phaseHead[2] || "").replace(/\*\*+$/, "").trim(),
    };
  }

  const cross = text.match(/^X\.(\d+)(?:\.(\d+))?\s+(\S.*)$/);
  if (cross) {
    return {
      kind: cross[2] === undefined ? "group" : "topic",
      phaseOrder: CROSS_CUTTING_ORDER,
      groupOrder: Number(cross[1]),
      topicOrder: cross[2] === undefined ? null : Number(cross[2]),
      title: cleanHeading(cross[3]),
    };
  }

  const kit = text.match(/^K\.(\d+)(?:\.(\d+))?\s+(\S.*)$/);
  if (kit) {
    return {
      kind: "topic",
      phaseOrder: CROSS_CUTTING_ORDER,
      groupOrder: KIT_GROUP_ORDER,
      topicOrder: Number(kit[1]),
      title: cleanHeading(kit[3]),
    };
  }

  const numbered = text.match(/^(\d+)\.(\d+)(?:\.(\d+))?\s+(\S.*)$/);
  if (numbered) {
    return {
      kind: numbered[3] === undefined ? "group" : "topic",
      phaseOrder: Number(numbered[1]),
      groupOrder: Number(numbered[2]),
      topicOrder: numbered[3] === undefined ? null : Number(numbered[3]),
      title: cleanHeading(numbered[4]),
    };
  }

  return null;
}

function parseStructure(lines) {
  const phases = [];
  let phase = null;
  let group = null;

  const endOfPart1 = lines.findIndex((line) => /^#\s+Full Stack Interview Roadmap: Expanded Edition/.test(line));
  const limit = endOfPart1 === -1 ? lines.length : endOfPart1;

  for (let i = 0; i < limit; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;

    if (/^#\s+PHASE\s+\d+/i.test(line)) {
      const raw = line.replace(/^#\s+/, "");
      const match = raw.match(/PHASE\s+(\d+)\s*:\s*(.*)/i);
      const order = Number(match?.[1] ?? phases.length + 1);
      const title = stripEmoji(match?.[2] ?? raw).trim();
      const difficulty = phaseDifficultyFor(order, line);

      phase = {
        order,
        title,
        difficulty,
        slug: `phase-${order}-${slugify(title)}`,
        icon: phaseIcon(order),
        color: phaseColor(order),
        estimatedHours: PHASE_HOURS[order] ?? 40,
        description: "",
        objectives: [],
        groups: [],
      };
      phases.push(phase);
      group = null;
      continue;
    }

    if (phase && /^##\s+/.test(line)) {
      // Phase-level free text (used by phase 13, which has no groups).
      const body = stripEmoji(line.replace(/^##\s+/, ""));
      phase.groups.push({
        title: `${title} Core Topics`,
        slug: `phase-${phase.order}-core-topics`,
        difficulty: phase.difficulty,
        description: `Core topics for ${phase.title}.`,
        estimatedHours: null,
        objectives: [],
        topics: [],
        _rawLine: body,
      });
      group = phase.groups[phase.groups.length - 1];
      continue;
    }

    if (phase && /^###\s+/.test(line)) {
      const raw = line.replace(/^###\s+/, "");
      const title = cleanHeading(raw) || stripEmoji(raw);
      const difficulty = groupDifficultyFor(raw, phase.difficulty);
      group = {
        title,
        slug: `${phase.slug}-${slugify(title)}`,
        difficulty,
        description: "",
        estimatedHours: null,
        objectives: [],
        topics: [],
      };
      phase.groups.push(group);
      continue;
    }

    if (phase && /^-\s+/.test(line)) {
      if (!group) {
        group = {
          title: `${phase.title} Topics`,
          slug: `${phase.slug}-topics`,
          difficulty: phase.difficulty,
          description: "",
          estimatedHours: null,
          objectives: [],
          topics: [],
        };
        phase.groups.push(group);
      }
      const kind = markerOf(line);
      const titles = splitTopics(line);
      for (const title of titles) {
        group.topics.push({
          title,
          slug: `${group.slug}-${slugify(title)}`,
          // The group marker wins over the phase default: a topic under
          // "Browser Internals (Advanced)" is Advanced even when its phase is
          // not. Falling back to the phase here is what flattened ~1,600
          // topics onto Beginner.
          difficulty: group.difficulty,
          origin: kind,
          estimatedMinutes: 60,
          objectives: [],
          keyConcepts: [],
          commonMistakes: [],
          practiceTasks: [],
          interviewQuestions: [],
          resources: [],
        });
      }
      continue;
    }

    if (phase && /^\d+\.\s+/.test(line) && !group) {
      // Projects / numbered lists at phase level.
      const title = stripEmoji(line.replace(/^\d+\.\s*/, "")).replace(/\*\*/g, "").trim();
      if (!group) {
        group = {
          title: `${phase.title} Milestones`,
          slug: `${phase.slug}-milestones`,
          difficulty: phase.difficulty,
          description: "",
          estimatedHours: null,
          objectives: [],
          topics: [],
        };
        phase.groups.push(group);
      }
      group.topics.push({
        title,
        slug: `${group.slug}-${slugify(title)}`,
        difficulty: group.difficulty,
        origin: "new",
        estimatedMinutes: 90,
        objectives: [],
        keyConcepts: [],
        commonMistakes: [],
        practiceTasks: [],
        interviewQuestions: [],
        resources: [],
      });
    }
  }

  return phases;
}

function phaseIcon(order) {
  const icons = [
    "\u{1F9ED}", "\u{1F331}", "\u{1F3A8}", "⚛️", "⚙️", "\u{1F5C4}️",
    "\u{1F510}", "☁️", "\u{1F9EA}", "\u{1F9EE}", "\u{1F3D7}️", "\u{1F4D0}",
    "\u{1F916}", "\u{1F91D}", "\u{1F3AF}",
  ];
  return icons[order - 1] ?? "\u{1F4D6}";
}

function phaseColor(order) {
  const colors = [
    "#6366f1", "#10b981", "#3b82f6", "#06b6d4", "#f59e0b", "#eab308",
    "#ef4444", "#0ea5e9", "#14b8a6", "#8b5cf6", "#d946ef", "#a855f7",
    "#ec4899", "#f59e0b", "#10b981",
  ];
  return colors[order - 1] ?? "#6366f1";
}

const PHASE_HOURS = {
  1: 20, 2: 60, 3: 90, 4: 80, 5: 70, 6: 60, 7: 40, 8: 60,
  9: 30, 10: 90, 11: 40, 12: 70, 13: 25, 14: 25, 15: 20,
};

const PHASE_DESCRIPTIONS = {
  1: "How the interview pipeline actually works, and how to plan, resource and track your preparation so you walk into each round with a plan.",
  2: "Zero-level foundations: how the web works, the terminal, Git, programming fundamentals and the developer environment.",
  3: "Frontend foundations: HTML, CSS, JavaScript core, TypeScript, browser internals, performance, accessibility and build tooling.",
  4: "Frontend frameworks: React in depth, meta-frameworks, state management, data fetching, routing and frontend architecture.",
  5: "Backend foundations: the Node.js runtime, Express, API design, background jobs, real-time systems and backend practices.",
  6: "Database systems: SQL and NoSQL, data modelling, ORMs, search and specialised stores, and caching layers.",
  7: "Networking and security: protocols, TLS, auth, cryptography and web application security.",
  8: "DevOps and cloud: containers, CI/CD, Linux in production, infrastructure as code, Kubernetes, networking and observability.",
  9: "Testing strategies: unit, integration and end-to-end tests, TDD, test doubles and coverage that means something.",
  10: "Coding challenges, CS fundamentals and DSA: complexity, core data structures, classic patterns and problem solving under time pressure.",
  11: "Architecture patterns and low-level design: SOLID, design patterns, domain-driven design and low-level system design.",
  12: "System design: scalability, estimation, distributed systems, a repeatable design framework and classic case studies.",
  13: "AI-era full stack skills: LLM APIs, streaming UX, RAG, tool calling, agents and evaluating AI features.",
  14: "Behavioral and engineering culture: storytelling, collaboration, code review practice, and what senior and staff scope looks like.",
  15: "Job search, offers and career: application materials, search strategy and negotiation.",
};

const PHASE_OBJECTIVES = {
  1: [
    "Know the stages of a full stack interview loop and what each one tests",
    "Build a backward plan from a fixed interview date with realistic buffers",
    "Run mock interviews on a schedule rather than at the last minute",
  ],
  2: [
    "Explain what happens between typing a URL and pixels appearing",
    "Navigate a shell and use pipes, redirection and permissions confidently",
    "Use Git branches, rebases and recovery tools without fear",
  ],
  3: [
    "Write semantic, accessible HTML and modern CSS without a framework",
    "Reason precisely about closures, `this`, the event loop and promises",
    "Diagnose and fix Core Web Vitals problems in a real page",
  ],
  4: [
    "Explain when React re-renders and how to stop unnecessary work",
    "Choose between server and client components deliberately",
    "Pick a state management approach that matches the problem",
  ],
  5: [
    "Explain the Node.js event loop phases and where blocking happens",
    "Design a REST API with predictable errors, pagination and versioning",
    "Add background jobs without losing work",
  ],
  6: [
    "Model data with normalisation and justify the trade-offs",
    "Diagnose a slow query with EXPLAIN and fix it with indexes",
    "Design a cache layer with an invalidation strategy you can reason about",
  ],
  7: [
    "Describe the TLS handshake and what each certificate proves",
    "Explain session vs JWT auth and where each one fails",
    "Threat-model a small application and defend your mitigations",
  ],
  8: [
    "Build and ship a container image you can reason about",
    "Write a pipeline that blocks on failure",
    "Instrument a service with logs, metrics and traces",
  ],
  9: [
    "Write tests that fail for the right reason",
    "Choose the right test level for each behaviour",
    "Keep a suite fast enough that people actually run it",
  ],
  10: [
    "Derive time and space complexity for any function you write",
    "Recognise the pattern behind an unfamiliar problem",
    "Solve, explain and test a problem inside a 45 minute interview",
  ],
  11: [
    "Apply SOLID where it pays and ignore it where it does not",
    "Turn a vague requirement into modular components with clear boundaries",
    "Explain why one design beats its alternatives",
  ],
  12: [
    "Estimate capacity for an unfamiliar system in under ten minutes",
    "Walk a design through requirements, API, data model and bottlenecks",
    "Discuss consistency, latency and cost trade-offs out loud",
  ],
  13: [
    "Integrate an LLM API with streaming and sensible fallbacks",
    "Build a retrieval pipeline and explain where it fails",
    "Evaluate an AI feature instead of shipping on vibes",
  ],
  14: [
    "Answer behavioural questions with concrete stories and outcomes",
    "Review code in a way that improves the author, not just the diff",
    "Describe senior and staff scope in terms of influence, not headcount",
  ],
  15: [
    "Produce application material that survives an ATS",
    "Run a search with referrals instead of applications",
    "Negotiate an offer using total compensation, not base salary alone",
  ],
};

// ─────────────────────────────────────────────
// Part 2: content
// ─────────────────────────────────────────────

function parseExpanded(lines, { requireMarker = true } = {}) {
  const markerIndex = lines.findIndex((line) =>
    /^#\s+Full Stack Interview Roadmap: Expanded Edition/.test(line),
  );

  // The main roadmap file announces the expanded edition explicitly. Secondary
  // documents are expanded content from the first line, so the marker is skipped.
  //
  // Only slice when the caller actually wants the outline's semantics. Applying
  // it to the per-phase files was destructive: 15.md repeats the marker at line
  // 3,274 of 16,424, so everything above it - a fifth of the phase, including
  // the whole of "Application Materials" - was thrown away before parsing began.
  if (requireMarker) {
    if (markerIndex === -1) return new Map();
    lines = lines.slice(markerIndex);
  }

  const sections = [];
  const groupIntros = [];
  const phaseIntros = [];
  let orphansAttached = 0;
  let orphansDropped = 0;
  let orphanMarkdown = "";

  /** Preserve the pending group prose before a new group heading displaces it. */
  const stashGroupIntro = () => {
    if (groupIntro && groupBody.join("\n").trim()) {
      groupIntros.push({
        title: groupIntro.title,
        number: groupIntro.number,
        bodyMarkdown: groupBody.join("\n").trim(),
      });
    }
    groupIntro = null;
    groupBody = [];
  };

  /** Same, for phase-level prose. A "PART 2" heading displaces "PART 1". */
  const stashPhaseIntro = () => {
    if (phaseIntro && phaseBody.join("\n").trim()) {
      phaseIntros.push({
        order: phaseIntro.order,
        title: phaseIntro.title,
        bodyMarkdown: phaseBody.join("\n").trim(),
      });
    }
    phaseIntro = null;
    phaseBody = [];
  };

  let heading = null;
  let headingNumber = null;
  let headingLine = -1;
  let archetype = null;
  let parentTopic = null;
  let parentNumber = null;
  let body = [];
  let inFence = false;
  // Prose that belongs to a group or a phase rather than to any single chapter.
  // It has no topic of its own, so without somewhere to put it it was dropped:
  // Phase 10 lost 600+ lines to group headings alone.
  let groupIntro = null;
  let groupBody = [];
  let phaseIntro = null;
  let phaseBody = [];
  let topicOrder = 0;
  // Content that arrives with no topic, group or phase open - Phase 7's
  // debugging scenarios, for instance, are headed `## 7. A WAF rule change...`
  // and sit after the last numbered chapter of their group. Dropping it was the
  // single largest remaining hole, so it is attached to the chapter above
  // instead, which is where a reader would look for it.
  let orphanBody = [];
  /** The most recent numbered topic title, used to give a practice block context. */
  let lastTopicTitle = null;
  /** The most recent numbered topic's own numbering, used to place a block. */
  let lastTopicNumber = null;

  const flush = () => {
    if (heading === null) return;
    sections.push({ title: heading, number: headingNumber, line: headingLine, archetype, parentTopic, parentNumber, body });
    heading = null;
    archetype = null;
    parentTopic = null;
    parentNumber = null;
  };

  /**
   * The expanded edition is inconsistent about heading depth: Phase 1 uses
   * `### N.N.N Title`, while later parts use `# N.N.N Title`. Heading depth is
   * therefore ignored and the numbering decides what a heading is:
   *
   *   N.N.N  topic section
   *   N.N    group heading
   *   N      phase heading
   *
   * Beyond the numbered topics, the documents carry four more archetypes. They
   * are practice material rather than knowledge, and turning them into topics
   * would be actively wrong: "RAPID-FIRE" is not something you study, it is
   * something you drill yourself on.
   */
  const ARCHETYPES = [
    [/^drill\b/i, "drill"],
    [/^scenario\b/i, "scenario"],
    [/rapid[\s-]?fire/i, "rapidfire"],
    [/\bq\s*&\s*a\b|interview[- ]style q|interview q\s*&\s*a|interview questions\b/i, "qa"],
    [/machine[\s-]?coding|machine[\s-]?problem/i, "machineCoding"],
    [/readiness checklist|final checklist|final readiness/i, "checklist"],
    [/ledger|cheat ?sheet|interview kit/i, "reference"],
  ];

  const archetypeOf = (rawTitle) => {
    for (const [pattern, kind] of ARCHETYPES) {
      if (pattern.test(rawTitle)) return kind;
    }
    return null;
  };

  /**
   * `### Q7. question` — a question heading inside a Q&A block.
   *
   * It is a sub-heading of the block above it, not a section boundary: the
   * answer it introduces is written underneath it. Treating it as a boundary
   * truncates the block at the first question and loses every answer with it.
   */
  const QUESTION_HEADING_RE = /^\s*Q\s*\d+\s*[.:)]\s*\S/i;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line === undefined) continue;

    // A `#` at the start of a line inside a fence is a code comment (YAML
    // front matter, a shell snippet, a Dockerfile), never a heading. Tracking
    // fences is what stops `# .github/CODEOWNERS` from being read as a section.
    if (line.trim().startsWith("```")) {
      inFence = !inFence;
      if (heading !== null) body.push(line);
      else if (groupIntro) groupBody.push(line);
      else if (phaseIntro) phaseBody.push(line);
      continue;
    }
    if (inFence) {
      if (heading !== null) body.push(line);
      else if (groupIntro) groupBody.push(line);
      else if (phaseIntro) phaseBody.push(line);
      continue;
    }

const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const raw = headingMatch[2];
      const trimmed = raw.trim();
      const kind = archetypeOf(trimmed);
      const info = classifyHeading(trimmed);

      if (info && info.kind === "topic") {
        // A numbered chapter: `1.1.3 Topic`, `X.1.1 Project`, `K.1 Scorecards`.
        // Depth is ignored - 01.md writes these at `###` and 02.md at `##` - so
        // the numbering decides. `X.*` and `K.*` belong to Phase 16.
        flush();
        heading = info.title;
        topicOrder += 1;
        headingNumber = [info.phaseOrder, info.groupOrder, info.topicOrder ?? topicOrder];
        headingLine = i;
        lastTopicTitle = heading;
        lastTopicNumber = headingNumber;
        body = [];
      } else if (kind) {
        // A practice block. It follows the numbered topic above it, so it keeps
        // that topic's context and is stored as practice rather than as a topic.
        flush();
        heading = cleanHeading(trimmed) || trimmed;
        headingNumber = null;
        headingLine = i;
        archetype = kind;
        parentTopic = lastTopicTitle;
        parentNumber = lastTopicNumber;
        body = [];
      } else if (info && info.kind === "group") {
        // A group heading ends the chapter above it and opens prose that belongs
        // to the group, not to any chapter. The outgoing prose is stashed first:
        // overwriting it here kept only the last prose group in each file, which
        // is how fifteen of Phase 7's sixteen groups were silently emptied.
        flush();
        stashGroupIntro();
        stashPhaseIntro();
        groupIntro = { title: info.title, number: [info.phaseOrder, info.groupOrder] };
        groupBody = [];
      } else if (info && info.kind === "phase") {
        flush();
        stashPhaseIntro();
        stashGroupIntro();
        phaseIntro = { order: info.phaseOrder, title: info.title };
        phaseBody = [];
      } else if (QUESTION_HEADING_RE.test(raw) && heading !== null) {
        // Keep the question heading with the block that owns it.
        body.push(line);
      } else if (headingMatch[1].length >= 2 && /^\*\*/.test(trimmed) && heading !== null) {
        // A bold sub-heading such as "## **8-week standard**" is part of the
        // section above it, not a new one. Treating it as a boundary split the
        // section into several same-titled pieces, and since rows are keyed by
        // slug only the last survived, silently dropping the earlier text.
        body.push(line);
      } else if (headingMatch[1].length >= 2 && heading !== null) {
        // Any sub-heading inside a section - "## REST and HTTP semantics",
        // "## STORY 1 - the win", "#### Weak answer" - belongs to the section
        // above it. Treating them as boundaries ended the enclosing section,
        // so everything beneath was dropped or re-keyed into a duplicate that
        // overwrote the original. Phase 10 alone loses 600+ lines this way.
        body.push(line);
      } else if (heading !== null || groupIntro || phaseIntro) {
        // An unnumbered heading inside a group- or phase-level preamble is part
        // of that preamble ("## Why this phase exists").
        if (groupIntro) groupBody.push(line);
        else if (phaseIntro) phaseBody.push(line);
        else body.push(line);
      } else {
        // Nothing is open. Keep the line against the chapter above rather than
        // discarding it.
        orphanBody.push(line);
      }
      continue;
    }

    if (heading !== null) body.push(line);
    else if (groupIntro) groupBody.push(line);
    else if (phaseIntro) phaseBody.push(line);
    else orphanBody.push(line);
  }
  flush();
  stashGroupIntro();
  stashPhaseIntro();
  // Orphan attachment is deferred until `topics` is built below.

  const topics = new Map();
  const practice = [];

  for (const section of sections) {
    const key = normalizeKey(section.title);
    if (!key) continue;

    const parsed = parseSection(section.body);
    parsed.raw = section.title;
    parsed.number = section.number;
    parsed.archetype = section.archetype ?? null;
    parsed.parentTopic = section.parentTopic ?? null;
    parsed.parentNumber = section.parentNumber ?? null;
    parsed.bodyLines = section.body ?? [];

    if (section.archetype) {
      practice.push(parsed);
      continue;
    }

    if (!topics.has(key)) topics.set(key, parsed);
  }

  // Attach orphan prose (content with no topic, group or phase open) to the
  // chapter above it, if one exists. This catches Phase 7's debugging scenarios
  // and other trailing prose that would otherwise be discarded.
  if (orphanBody.join("\n").trim()) {
    const orphanKey = lastTopicTitle ? normalizeKey(lastTopicTitle) : "";
    const owner = orphanKey ? topics.get(orphanKey) : null;
    if (owner) {
      owner.bodyMarkdown = appendBody(owner, orphanBody.join("\n").trim()).bodyMarkdown;
      orphansAttached += 1;
    } else {
      orphanMarkdown = orphanBody.join("\n").trim();
      orphansDropped = orphanBody.filter((l) => l.trim()).length;
    }
  }

  topics.orphanMarkdown = orphanMarkdown;
  topics.orphansDropped = orphansDropped;
  topics.orphansAttached = orphansAttached;
  topics.practice = practice;
  topics.groupIntros = groupIntros;
  topics.phaseIntros = phaseIntros;
  return topics;
}

// ─────────────────────────────────────────────
// Merge
// ─────────────────────────────────────────────

/**
 * Resolves each Part 1 topic title to its Part 2 section.
 *
 * Titles rarely match character-for-character across the two parts ("Timeline
 * planning" vs "Timeline Planning (including Handling Interview Anxiety)"), so
 * matching escalates: exact key, then unique containment, then a token-overlap
 * score above a threshold. A match is only accepted when it is unambiguous, so a
 * topic never silently inherits another topic's content.
 */
function buildResolver(expanded) {
  const keys = Array.from(expanded.keys());

  return function resolve(topicKey, groupKey) {
    if (expanded.has(topicKey)) return expanded.get(topicKey);

    const withGroup = `${groupKey} ${topicKey}`;
    if (expanded.has(withGroup)) return expanded.get(withGroup);

    // Containment: the section heading includes the topic title.
    const contained = keys.filter(
      (key) => key.includes(topicKey) || topicKey.includes(key),
    );
    if (contained.length === 1) return expanded.get(contained[0]);

    // Token overlap fallback for the remaining cases.
    const tokens = topicKey.split(" ").filter((token) => token.length > 3);
    if (tokens.length === 0) return undefined;

    let best;
    let bestScore = 0;
    let bestCount = 0;

    for (const key of keys) {
      const overlap = tokens.filter((token) => key.includes(token)).length;
      const score = overlap / tokens.length;
      if (score > bestScore) {
        bestScore = score;
        best = key;
        bestCount = 1;
      } else if (score === bestScore && score > 0) {
        bestCount += 1;
      }
    }

    // Require a high score and an unambiguous winner.
    if (best && bestScore >= 0.75 && bestCount === 1) return expanded.get(best);
    return undefined;
  };
}

/**
 * Adopt expanded sections that Part 1 did not list.
 *
 * The condensed roadmap lists ~1050 topics, while the expanded edition adds
 * hundreds more (for example "Stale closures and how to fix them" inside React
 * Concepts). Dropping them would violate the rule that no provided topic is
 * skipped, so they are placed back using their own numbering: `6.3.2` means
 * phase 6, group 3, and lands there — in the phase's own group when one exists,
 * otherwise in a clearly labelled additional group.
 */
function adoptOrphanSections(phases, expanded) {
  const byKey = new Map();
  for (const phase of phases) {
    for (const group of phase.groups) {
      for (const topic of group.topics) byKey.set(normalizeKey(topic.title), { phase, group, topic });
    }
  }

  const adopted = [];

  for (const [key, section] of expanded) {
    if (byKey.has(key)) continue;

    // The deep dives restate a topic in a fuller title: the outline says
    // "Resource selection" where the chapter heading says "Resource Selection
    // and Curation". Folding those together by title similarity was tried and
    // reverted: a prefix test also matched unrelated pairs such as "Unit
    // Testing" against "Integration Testing", which deleted real topics. The
    // duplicate is left in place rather than risk losing content.

    let phase = null;
    let group = null;

    if (section.number) {
      const [phaseOrder, groupIndex] = section.number;
      phase = phases.find((candidate) => candidate.order === phaseOrder) ?? null;

      if (phase) {
        group = phase.groups[groupIndex - 1] ?? null;
        if (!group) {
          // The expanded edition has more groups than the condensed list. Add a
          // sibling group so the content keeps its place in the hierarchy.
          //
          // It must be reused on later encounters: the expanded edition skips some
          // group numbers (6.17, 6.28), so the same group index is requested more
          // than once. Creating a new group each time would collide on slug and
          // silently merge unrelated topics.
          const syntheticSlug = `${phase.slug}-extra-${groupIndex}`;
          const existing = phase.groups.find((candidate) => candidate.slug === syntheticSlug);

          if (existing) {
            group = existing;
          } else {
            group = {
              title: `${phase.title}: Additional Topics ${groupIndex}`,
              slug: syntheticSlug,
              difficulty: phase.difficulty,
              description: `Additional expanded topics for ${phase.title}.`,
              estimatedHours: null,
              objectives: [],
              topics: [],
              _synthetic: true,
            };
            phase.groups.push(group);
          }
        }
      }
    }

    if (!phase || !group) {
      // No usable numbering: place it in a trailing catch-all group for the last
      // phase so the content is still reachable rather than silently dropped.
      phase = phases[phases.length - 1];
      group = phase.groups[phase.groups.length - 1];
    }

    const topic = {
      title: section.raw,
      slug: `${group.slug}-${slugify(section.raw)}`,
      difficulty: section.difficulty ?? group.difficulty,
      origin: "expanded",
      estimatedMinutes: 60,
      objectives: [],
      keyConcepts: section.keyConcepts.slice(0, 12),
      commonMistakes: section.mistakes.slice(0, 8),
      practiceTasks: [...section.practice, ...section.selfCheck].slice(0, 8),
      interviewQuestions: section.questions.slice(0, 12).map((question) => ({
        text: question.text,
        answer: question.answer ?? "",
})),
      interview: {
        whyAsked: section.whyAsked ?? "",
        evaluation: section.evaluation.slice(0, 8),
        sayOutLoud: section.sayOutLoud ?? "",
        probe: section.probe.slice(0, 5),
        wrongAnswers: section.wrongAnswers.slice(0, 8),
        tradeoffs: section.tradeoffs.slice(0, 8),
        signal: section.interviewSignal ?? "",
        prerequisites: section.prerequisites.slice(0, 6),
        answeredCount: section.questions.filter((question) => question.answer).length,
        questionCount: section.questions.length,
      },
      troubleshooting:
        section.symptoms.length > 0 ||
        section.investigation.length > 0 ||
        section.rootCause.length > 0
          ? {
              symptoms: section.symptoms.slice(0, 6),
              investigation: section.investigation.slice(0, 8),
              rootCause: section.rootCause.slice(0, 4),
              fix: section.fix.slice(0, 6),
              prevention: section.prevention.slice(0, 6),
              tools: section.tools.slice(0, 6),
            }
          : null,
      referenceMarkdown:
        (section.bodyMarkdown || section.__reference || "").slice(0, 200_000) || null,
      resources: section.resources.slice(0, 10),
      description:
        [section.definition, section.whyAsked].filter(Boolean).join(" ") ||
        `${section.raw} within ${group.title}.`,
      _priority: section.priority,
      _contentSource: "expanded-only",
    };

    group.topics.push(topic);
    byKey.set(key, { phase, group, topic });
    adopted.push(topic);
  }

  return adopted;
}

/**
 * Removes topics that repeat within a single group.
 *
 * The source genuinely lists a few topics twice — `debounce` and `throttle`
 * appear both in the JavaScript core concept list and again under
 * "must-implement-from-scratch". They are the same topic, so the first
 * occurrence wins. Cross-group repeats are KEPT, because the same concept
 * genuinely belongs to more than one group.
 */
function dedupeGroupTopics(phases, stats) {
  for (const phase of phases) {
    for (const group of phase.groups) {
      const seen = new Set();
      const kept = [];
      for (const topic of group.topics) {
        if (seen.has(topic.slug)) {
          stats.duplicates = (stats.duplicates ?? 0) + 1;
          continue;
        }
        seen.add(topic.slug);
        kept.push(topic);
      }
      group.topics = kept;
    }
  }
  return phases;
}

function mergeContent(phases, expanded, stats) {
  const resolve = buildResolver(expanded);

  for (const phase of phases) {
    phase.description = PHASE_DESCRIPTIONS[phase.order] ?? phase.title;
    phase.objectives = PHASE_OBJECTIVES[phase.order] ?? [];

    for (const group of phase.groups) {
      if (group._rawLine) {
        // Phase 13 style: a single group whose topics came from one bullet.
        group.topics = group.topics.map((topic) => ({ ...topic, description: topic.title }));
        group.description = `Core topics for ${phase.title}.`;
        delete group._rawLine;
      } else {
        group.description = `${group.title} within ${phase.title}.`;
      }

      const groupKey = normalizeKey(group.title);

      for (const topic of group.topics) {
        stats.topics += 1;

        const candidates = [
          normalizeKey(topic.title),
          `${groupKey} ${normalizeKey(topic.title)}`,
        ];
        const section = candidates.map((key) => expanded.get(key)).find(Boolean) ?? resolve(candidates[0], groupKey);

        if (!section) {
          topic.description = `${topic.title} — part of ${group.title} in ${phase.title}.`;
          topic._contentSource = "structure-only";
          continue;
        }

        console.log(`[MERGE] topic: ${topic.title}, has checklist: ${Array.isArray(section.checklist) ? section.checklist.length : "no"}`);

        if (section.difficulty) topic.difficulty = section.difficulty;

        topic.description =
          [section.definition, section.whyAsked].filter(Boolean).join(" ") ||
          `${topic.title} within ${group.title}.`;

        topic.keyConcepts = section.keyConcepts.slice(0, 12);
        topic.commonMistakes = section.mistakes.slice(0, 8);
        topic.practiceTasks = [...section.practice, ...section.selfCheck].slice(0, 8);
        topic.checklist = section.checklist ?? [];
        if (section.checklist && section.checklist.length > 0) {
          console.log(`[MERGE] topic: ${topic.title}, section.checklist: ${section.checklist.length}, topic.checklist: ${topic.checklist.length}`);
        }
        console.log(`[DEBUG] topic: ${topic.title}, checklist length: ${topic.checklist.length}`);
        topic.resources = section.resources.slice(0, 10);

        // Questions keep their model answers attached. A question with no answer
        // is still worth showing: knowing it will be asked is most of the value.
        topic.interviewQuestions = section.questions.slice(0, 12).map((question) => ({
          text: question.text,
          answer: question.answer ?? "",
        }));

        if (topic.interviewQuestions.length === 0 && section.keyConcepts.length > 0) {
          // Derive interview prompts from the concepts when the source has no
          // explicit question list. Marked as derived so it is not mistaken for
          // a curated question.
          //
          // Only noun-phrase concepts are usable. A concept that is a sentence,
          // a field name, or a fragment produces a nonsensical prompt such as
          // "Explain and when you would use it.", so those are skipped. Real
          // concepts are short and unterminated.
          const usable = section.keyConcepts.filter((concept) => {
            const text = concept.trim();
            return (
              text.length >= 8 &&
              text.length <= 90 &&
              !text.includes(":") &&
              !/[.!?,;]$/.test(text)
            );
          });
          const source = usable.length > 0 ? usable : section.keyConcepts;
          topic.interviewQuestions = source.slice(0, 5).map((concept) => ({
            text: `Explain ${concept.toLowerCase()} and when you would use it.`,
            answer: "",
            derived: true,
          }));
        }

        // The interview payload: everything that only matters when someone is
        // sitting across from you and judging the answer.
        topic.interview = {
          whyAsked: section.whyAsked ?? "",
          evaluation: section.evaluation.slice(0, 8),
          sayOutLoud: section.sayOutLoud ?? "",
          probe: section.probe.slice(0, 5),
          wrongAnswers: section.wrongAnswers.slice(0, 8),
          tradeoffs: section.tradeoffs.slice(0, 8),
          signal: section.interviewSignal ?? "",
          prerequisites: section.prerequisites.slice(0, 6),
          answeredCount: topic.interviewQuestions.filter((q) => q.answer).length,
          questionCount: topic.interviewQuestions.length,
        };

        // Verbatim body so nothing the author wrote is lost (tables, prose outside
        // recognised labels, etc.). This is the safety net for 100% coverage.
        topic.bodyMarkdown = section.bodyMarkdown ?? "";

        // The debugging-runbook archetype: symptom -> investigation -> cause ->
        // fix -> prevention. Present only on the scenario topics that use it.
        const isRunbook =
          section.symptoms.length > 0 || section.investigation.length > 0 || section.rootCause.length > 0;
        topic.troubleshooting = isRunbook
          ? {
              symptoms: section.symptoms.slice(0, 6),
              investigation: section.investigation.slice(0, 8),
              rootCause: section.rootCause.slice(0, 4),
              fix: section.fix.slice(0, 6),
              prevention: section.prevention.slice(0, 6),
              tools: section.tools.slice(0, 6),
            }
          : null;

        topic.referenceMarkdown =
          (section.bodyMarkdown || section.__reference || "").slice(0, 200_000) || null;

        topic._priority = section.priority;
        topic._contentSource = "expanded";

        stats.questions += topic.interviewQuestions.length;
        stats.practice += topic.practiceTasks.length;
        stats.answers = (stats.answers ?? 0) + topic.interview.answeredCount;
        stats.rubrics = (stats.rubrics ?? 0) + (topic.interview.evaluation.length > 0 ? 1 : 0);
        stats.spokenAnswers = (stats.spokenAnswers ?? 0) + (topic.interview.sayOutLoud ? 1 : 0);
        stats.runbooks = (stats.runbooks ?? 0) + (topic.troubleshooting ? 1 : 0);
      }

      if (group.topics.length === 0) {
        // Empty group (a heading with no bullet list) still belongs in the map.
        group.description = group.description || group.title;
      }
    }
  }

  return stats;
}

// ─────────────────────────────────────────────
// Emit
// ─────────────────────────────────────────────

/**
 * Returns a block body as raw markdown. Fence markers are preserved so code
 * samples inside a drill survive to the page intact.
 */
function rawBodyOf(block) {
  return block.bodyLines?.join("\n") ?? null;
}

/**
 * prompts and readiness checklists) onto the phase they belong to.
 *
 * These are NOT topics. A drill is something you do to yourself; a rapid-fire
 * list is a revision aid; a readiness checklist tells you whether you are done
 * with a phase. Turning them into topics would inflate completion counts and
 * make progress meaningless, so they are stored separately and rendered as
 * practice content.
 */
function attachPractice(phases, practiceBlocks, stats) {
  const byPhaseNumber = new Map(phases.map((phase) => [phase.order, phase]));

  for (const block of practiceBlocks) {
    // Placement order: the block's own numbering, then the numbering of the
    // numbered topic it followed, then a title match. A phase-level block such
    // as "PHASE 3 RAPID-FIRE" has no parent topic, so it lands on the phase
    // implied by whichever phase it appears in.
    let phase = null;

    if (block.number?.[0]) {
      phase = byPhaseNumber.get(block.number[0]) ?? null;
    }
    if (!phase && block.parentNumber?.[0]) {
      phase = byPhaseNumber.get(block.parentNumber[0]) ?? null;
    }

    if (!phase && block.parentTopic) {
      const parentKey = normalizeKey(block.parentTopic);
      for (const candidate of phases) {
        for (const group of candidate.groups) {
          for (const topic of group.topics) {
            if (normalizeKey(topic.title) === parentKey) {
              phase = candidate;
              break;
            }
          }
        }
        if (phase) break;
      }
    }

    if (!phase) {
      stats.unplacedPractice = (stats.unplacedPractice ?? 0) + 1;
      continue;
    }

    const items = [
      ...block.keyConcepts,
      ...block.questions.map((question) => question.text),
      ...block.practice,
      ...block.selfCheck,
    ].slice(0, 40);

    // A block's prose body is the only guarantee that nothing authored is lost:
    // extraction is a heuristic, and the per-phase files carry a great deal of
    // prose in blocks that also have structured fields. The body therefore goes
    // into the reference slot for structured blocks - the card renders it in a
    // scrollable "Reference material" panel - and into markdown for blocks that
    // have no structured rendering at all.
    const bodyText = (rawBodyOf(block) ?? "").trim().slice(0, 200_000);
    const reference =
      [block.__reference ?? "", bodyText].filter(Boolean).join("\n\n").trim().slice(0, 200_000) ||
      null;

    const hasStructuredContent =
      items.length > 0 ||
      Boolean(block.sayOutLoud) ||
      Boolean(block.whyAsked) ||
      block.evaluation.length > 0 ||
      block.probe.length > 0 ||
      block.rootCause.length > 0 ||
      Boolean(block.interviewSignal) ||
      Boolean(reference);

    // A block whose content is a table, a diagram or prose has none of the
    // structured fields. Dropping it would lose authored content, so the raw
    // body is kept as markdown and rendered verbatim instead.
    const rawMarkdown = hasStructuredContent ? null : bodyText || null;

    if (!hasStructuredContent && !rawMarkdown) {
      stats.emptyPractice = (stats.emptyPractice ?? 0) + 1;
      continue;
    }

    phase.practice = phase.practice ?? [];
    phase.practice.push({
      kind: block.archetype,
      title: block.raw,
      afterTopic: block.parentTopic ?? null,
      items,
      // Questions authored inside the block. Markdown-table rapid-fire and Q&A
      // material lands here, which is what makes it reachable from the question
      // bank instead of being trapped inside a rendered table.
      questions: block.questions ?? [],
      // Drills are where you rehearse an answer out loud, so the spoken answer,
      // the follow-up probe and the rubric belong here as much as on a topic.
      whyAsked: block.whyAsked || "",
      evaluation: block.evaluation.slice(0, 6),
      sayOutLoud: block.sayOutLoud || "",
      probe: block.probe.slice(0, 4),
      signal: block.interviewSignal || "",
      // Scenario archetype: symptom -> investigation -> cause -> fix.
      symptoms: block.symptoms.slice(0, 5),
      investigation: block.investigation.slice(0, 6),
      rootCause: block.rootCause.slice(0, 3),
      fix: block.fix.slice(0, 5),
      prevention: block.prevention.slice(0, 5),
      tools: block.tools.slice(0, 5),
      mistakes: block.mistakes.slice(0, 6),
      reference,
      markdown: rawMarkdown,
    });
    stats.practiceBlocks = (stats.practiceBlocks ?? 0) + 1;
    stats.practiceItems = (stats.practiceItems ?? 0) + items.length;
    if (block.sayOutLoud) stats.spokenAnswers = (stats.spokenAnswers ?? 0) + 1;
    if (block.probe.length > 0) stats.probes = (stats.probes ?? 0) + 1;
    if (block.rootCause.length > 0) stats.scenarios = (stats.scenarios ?? 0) + 1;
  }

  return phases;
}

function serialisePhase(phase) {
  return {
    order: phase.order,
    slug: phase.slug,
    title: phase.title,
    description: phase.description,
    difficulty: phase.difficulty,
    difficultyLabel: DIFFICULTY_NAME[phase.difficulty],
    icon: phase.icon,
    color: phase.color,
    estimatedHours: phase.estimatedHours,
    objectives: phase.objectives,
    practice: phase.practice ?? [],
    groups: phase.groups.map((group) => ({
      slug: group.slug,
      title: group.title,
      description: group.description,
      difficulty: group.difficulty,
      estimatedHours: group.estimatedHours,
      objectives: group.objectives,
      topics: group.topics.map((topic) => {
        if (topic.checklist && topic.checklist.length > 0) {
          console.log(`[SERIALISE] topic: ${topic.title}, checklist: ${topic.checklist.length}`);
        }
        return {
          slug: topic.slug,
        title: topic.title,
        description: topic.description,
        difficulty: topic.difficulty,
        estimatedMinutes: topic.estimatedMinutes,
        origin: topic.origin,
        priority: topic._priority ?? null,
        objectives: topic.objectives,
        keyConcepts: topic.keyConcepts,
        commonMistakes: topic.commonMistakes,
        practiceTasks: topic.practiceTasks,
        interviewQuestions: topic.interviewQuestions,
        interview: topic.interview ?? null,
        troubleshooting: topic.troubleshooting ?? null,
        referenceMarkdown: topic.referenceMarkdown ?? null,
        bodyMarkdown: topic.bodyMarkdown ?? null,
        checklist: topic.checklist ?? null,
        resources: topic.resources,
        contentSource: topic._contentSource,
}}) ,
}),
  };
}

/**
 * Builds the roadmap structure from the per-phase files themselves.
 *
 * The standalone outline was folded into ../phase by hand - the cross-cutting
 * tracks became `00-roadmap-spine.md` and each deep dive absorbed its share of
 * `expand.md` - so the numbered headings in those files are now the only
 * description of the roadmap. Detection is by numbering (see
 * `classifyHeading`), never by heading depth.
 *
 * Returns the same shape as `parseStructure`, so every downstream step
 * (merge, adopt, fold, serialise) is unchanged.
 */
function parseStructureFromPhaseFiles(paths) {
  const phases = new Map();

  const ensurePhase = (order, title) => {
    let phase = phases.get(order);
    if (!phase) {
      const resolved = title || `Phase ${order}`;
      phase = {
        order,
        title: resolved,
        difficulty: phaseDifficultyFor(order, ""),
        slug: `phase-${order}-${slugify(resolved)}`,
        icon: phaseIcon(order),
        color: phaseColor(order),
        estimatedHours: PHASE_HOURS[order] ?? 40,
        description: "",
        objectives: [],
        groups: [],
      };
      phases.set(order, phase);
    } else if (title && /^Phase \d+$/.test(phase.title)) {
      // The numbered heading arrived before the `# PHASE n:` title; fill it in.
      phase.title = title;
      phase.slug = `phase-${order}-${slugify(title)}`;
    }
    return phase;
  };

  const ensureGroup = (phase, order, title, difficulty) => {
    let group = phase.groups.find((g) => g.order === order);
    if (!group) {
      group = {
        order,
        title: title || `Group ${order}`,
        slug: `phase-${phase.order}-${slugify(`${order}-${title || "group"}`)}`,
        difficulty,
        description: "",
        estimatedHours: null,
        objectives: [],
        topics: [],
      };
      phase.groups.push(group);
    } else if (title && /^Group \d+$/.test(group.title)) {
      group.title = title;
      group.slug = `phase-${phase.order}-${slugify(`${order}-${title}`)}`;
    }
    return group;
  };

  const addTopic = (group, order, title, minutes) => {
    if (!title) return;
    if (group.topics.some((topic) => topic.title === title)) return;
    group.topics.push({
      order,
      title,
      slug: `${group.slug}-${slugify(title)}`,
      difficulty: group.difficulty,
      origin: "new",
      estimatedMinutes: minutes ?? 60,
      objectives: [],
      keyConcepts: [],
      commonMistakes: [],
      practiceTasks: [],
      interviewQuestions: [],
      resources: [],
    });
  };

  for (const path of paths) {
    const name = path.replace(/\\/g, "/").split("/").pop();
    // `00-roadmap-spine.md` is the cross-cutting layer and becomes Phase 16.
    const fileOrder = Number((name.match(/^(\d{2})/) ?? [])[1] ?? 0);
    let lines;
    try {
      lines = readFileSync(path, "utf8").split(/\r?\n/);
    } catch {
      continue;
    }

    let phaseOrder = fileOrder === 0 ? CROSS_CUTTING_ORDER : fileOrder;
    if (phaseOrder === 0) phaseOrder = CROSS_CUTTING_ORDER;
    let topicOrder = 0;

    for (const line of lines) {
      const heading = line.match(/^#{1,6}\s+(.+)$/);
      if (!heading) continue;
      const info = classifyHeading(heading[1].trim());
      if (!info) continue;

      if (info.kind === "phase") {
        phaseOrder = info.phaseOrder;
        ensurePhase(phaseOrder, info.title);
        continue;
      }

      const phase = ensurePhase(info.phaseOrder, info.phaseOrder === CROSS_CUTTING_ORDER ? CROSS_CUTTING_TITLE : null);
      const group = ensureGroup(phase, info.groupOrder, info.title, phase.difficulty);
      if (info.kind === "topic") {
        topicOrder += 1;
        addTopic(group, info.topicOrder ?? topicOrder, info.title);
      }
    }
  }

  return [...phases.values()].sort((a, b) => a.order - b.order);
}

let phases;
let structureLabel;
if (structurePath) {
  const lines = readFileSync(structurePath, "utf8").split(/\r?\n/);
  structureLabel = structurePath;
  phases = parseStructure(lines);
} else {
  // No standalone outline: the numbered headings in ../phase are the roadmap.
  structureLabel = `../phase (${expandedPaths.length} files)`;
  phases = parseStructureFromPhaseFiles(expandedPaths);
}

console.log(`Structure source: ${structureLabel}`);
console.log(
  `Parsed ${phases.length} phases, ${phases.reduce((sum, p) => sum + p.groups.length, 0)} groups, ${phases.reduce((sum, p) => sum + p.groups.reduce((g, g2) => g + g2.topics.length, 0), 0)} topics`,
);

// Merge every expanded document into a single lookup.
//
// Two different rules, on purpose.
//
// Structured fields - definition, key concepts, questions, mistakes - are
// first-wins. The outline and the expanded edition describe the same topics,
// and letting a later, differently-shaped source replace a section wholesale
// silently dropped a third of the question bank. First-wins keeps that stable.
//
// The raw body is the opposite: it accumulates. Structured extraction is a
// lossy heuristic, so the verbatim text is the only guarantee that nothing the
// author wrote is lost, and the per-phase deep dives must not be dropped just
// because the outline already mentioned the topic.
const expanded = new Map();
const practiceBlocks = [];
const groupIntros = new Map();
const phaseIntros = new Map();
const phaseOrphans = new Map();

/** Concatenate a later source's body onto the one already held. */
function appendBody(existing, incoming) {
  const a = (existing?.bodyMarkdown ?? "").trim();
  const b = (incoming ?? "").trim();
  if (!b) return existing;
  if (!a) return { ...existing, bodyMarkdown: b };
  if (a.includes(b)) return existing;
  return { ...existing, bodyMarkdown: `${a}\n\n---\n\n${b}` };
}

for (const path of expandedPaths) {
  let document;
  try {
    document = readFileSync(path, "utf8").split(/\r?\n/);
  } catch {
    console.warn(`Skipping missing content source: ${path}`);
    continue;
  }
  const before = expanded.size;
  const parsed = parseExpanded(document, { requireMarker: false });
  let extended = 0;
  for (const [key, value] of parsed) {
    const existing = expanded.get(key);
    if (!existing) {
      expanded.set(key, value);
      continue;
    }
    expanded.set(key, appendBody(existing, value.bodyMarkdown));
    if ((value.bodyMarkdown ?? "").trim()) extended += 1;
  }
  practiceBlocks.push(...(parsed.practice ?? []));
  // Prose that belongs to a group or a phase rather than to any chapter. It is
  // collected here and attached to the group/phase description once every source
  // has been read, so repeated introductions concatenate rather than overwrite.
  for (const intro of parsed.groupIntros ?? []) {
    const key = `${intro.number[0]}:${intro.number[1]}`;
    const existing = groupIntros.get(key);
    groupIntros.set(key, {
      number: intro.number,
      bodyMarkdown: existing
        ? `${existing.bodyMarkdown}\n\n---\n\n${intro.bodyMarkdown}`
        : intro.bodyMarkdown,
    });
  }
  for (const intro of parsed.phaseIntros ?? []) {
    const existing = phaseIntros.get(intro.order);
    phaseIntros.set(intro.order, {
      order: intro.order,
      bodyMarkdown: existing
        ? `${existing.bodyMarkdown}\n\n---\n\n${intro.bodyMarkdown}`
        : intro.bodyMarkdown,
    });
  }
  if (parsed.orphanMarkdown?.trim()) {
    const fileOrder = Number((path.split(/[\\/]/).pop()?.match(/^(\d{2})/) ?? [])[1] ?? 0);
    const phaseOrder = fileOrder === 0 ? CROSS_CUTTING_ORDER : fileOrder;
    const existing = phaseOrphans.get(phaseOrder);
    phaseOrphans.set(phaseOrder, {
      bodyMarkdown: existing
        ? `${existing.bodyMarkdown}\n\n---\n\n${parsed.orphanMarkdown.trim()}`
        : parsed.orphanMarkdown.trim(),
      dropped: (existing?.dropped ?? 0) + (parsed.orphansDropped ?? 0),
      attached: (existing?.attached ?? 0) + (parsed.orphansAttached ?? 0),
    });
  }
  console.log(
    `Content source:   ${path}  ${expanded.size - before} topic sections, ${extended} bodies extended, ` +
      `${(parsed.practice ?? []).length} practice blocks (${expanded.size} topics total)`,
  );
}
/**
 * Fold a chapter section into the outline topic it restates.
 *
 * The per-phase deep dives title a chapter more fully than the outline does:
 * the outline says "Resource selection", the chapter says "Resource Selection
 * and Curation". Left alone both are seeded and the roadmap shows the same
 * topic twice.
 *
 * The match is deliberately strict. Two titles must share their first two words
 * and one must be a prefix of the other, both normalised. A looser test was
 * tried and reverted: it matched "Unit Testing" against "Integration Testing"
 * and deleted real topics.
 *
 * The merge is a union, never a replacement, so no authored field or line of
 * body text is lost by folding.
 */
function foldChapterDuplicates(phases, expanded) {
  const outlineTopics = new Map();
  for (const phase of phases) {
    for (const group of phase.groups) {
      for (const topic of group.topics) {
        outlineTopics.set(normalizeKey(topic.title), { phaseOrder: phase.order, groupTitle: group.title });
      }
    }
  }

  // Chapter headings carry their number ("1.1.2 Resource Selection and
  // Curation"), so the numbering has to come off before the words are
  // compared, otherwise every chapter starts with "1".
  const words = (value) =>
    normalizeKey(String(value ?? "").replace(/^\s*\d+(?:\.\d+)*\s+/, ""))
      .split(" ")
      .filter(Boolean);

  const isRestatement = (chapterWords, topicWords) => {
    if (chapterWords.length < 2 || topicWords.length < 2) return false;
    if (chapterWords[0] !== topicWords[0] || chapterWords[1] !== topicWords[1]) return false;
    const [short, long] = chapterWords.length <= topicWords.length ? [chapterWords, topicWords] : [topicWords, chapterWords];
    return short.every((word, index) => long[index] === word);
  };

  /** Union two extracted sections without discarding anything. */
  const union = (target, incoming) => {
    const out = { ...target };
    for (const [key, value] of Object.entries(incoming)) {
      if (key === "raw" || key === "__reference" || key === "bodyMarkdown") continue;
      if (Array.isArray(value)) {
        if (!Array.isArray(out[key])) out[key] = [];
        const seen = new Set(out[key].map((entry) => normalizeKey(JSON.stringify(entry))));
        for (const entry of value) {
          const sig = normalizeKey(JSON.stringify(entry));
          if (!sig || seen.has(sig)) continue;
          seen.add(sig);
          out[key].push(entry);
        }
      } else if (typeof value === "string") {
        if (!out[key]) out[key] = value;
        else if (value.length > String(out[key]).length) out[key] = value;
      } else if (out[key] === null || out[key] === undefined) {
        out[key] = value;
      }
    }
    const a = (target.bodyMarkdown ?? "").trim();
    const b = (incoming.bodyMarkdown ?? "").trim();
    if (b && !a.includes(b)) out.bodyMarkdown = a ? `${a}\n\n---\n\n${b}` : b;
    return out;
  };

  let folded = 0;
  const report = [];
  for (const [key, section] of [...expanded]) {
    if (section.number && section.number.length < 3) continue; // only numbered chapters
    if (outlineTopics.has(key)) continue; // already attached to the outline topic of the same name
    const chapterWords = words(section.raw ?? key);
    if (chapterWords.length < 2) continue;

    for (const [topicKey, info] of outlineTopics) {
      if (topicKey === key) continue;
      if (!isRestatement(chapterWords, words(topicKey))) continue;
      if (info.phaseOrder !== (section.number?.[0] ?? info.phaseOrder)) continue;

      const existing = expanded.get(topicKey);
      expanded.set(topicKey, existing ? union(existing, section) : section);
      expanded.delete(key);
      folded += 1;
      report.push(`    phase ${info.phaseOrder}: "${section.raw}" -> "${topicKey}"`);
      break;
    }
  }

  if (folded > 0) {
    console.log(`  folded ${folded} chapter section(s) into the outline topic they restate:`);
    for (const line of report) console.log(line);
  }
  return folded;
}

const stats = { topics: 0, enriched: 0, questions: 0, practice: 0, duplicates: 0 };
// Must run before mergeContent: folding rewrites section keys, and mergeContent
// is what maps those keys onto roadmap topics.
foldChapterDuplicates(phases, expanded);
dedupeGroupTopics(phases, stats);
mergeContent(phases, expanded, stats);

const adopted = adoptOrphanSections(phases, expanded);
  stats.adopted = adopted.length;
  stats.topics += adopted.length;
  stats.enriched += adopted.length;
  stats.questions += adopted.reduce((sum, t) => sum + t.interviewQuestions.length, 0);
  stats.practice += adopted.reduce((sum, t) => sum + t.practiceTasks.length, 0);
  stats.answers = (stats.answers ?? 0) + adopted.reduce((sum, t) => sum + (t.interview?.answeredCount ?? 0), 0);
  stats.rubrics = (stats.rubrics ?? 0) + adopted.filter((t) => (t.interview?.evaluation.length ?? 0) > 0).length;
  stats.spokenAnswers = (stats.spokenAnswers ?? 0) + adopted.filter((t) => t.interview?.sayOutLoud).length;
  stats.runbooks = (stats.runbooks ?? 0) + adopted.filter((t) => t.troubleshooting).length;

// Practice blocks are attached last: a block's parent topic may be one of the
// sections that was just adopted, so the topic set has to be complete first.
attachPractice(phases, practiceBlocks, stats);

  console.log(
    `Enriched ${stats.enriched} topics (${stats.enriched - stats.adopted} matched, ${stats.adopted} adopted from the expanded edition)`,
  );
  console.log(
    `  interview content: ${stats.questions} questions, ${stats.answers} with model answers, ` +
      `${stats.rubrics} with an evaluation rubric, ${stats.spokenAnswers} with a spoken answer, ` +
      `${stats.runbooks} debugging runbooks, ${stats.practice} practice tasks`,
  );
  console.log(
    `  practice blocks: ${stats.practiceBlocks ?? 0} with ${stats.practiceItems ?? 0} items, ` +
      `${stats.scenarios ?? 0} debugging scenarios, ${stats.probes ?? 0} with follow-up probes, ` +
      `${stats.unplacedPractice ?? 0} unplaceable of ${practiceBlocks.length}`,
  );

mkdirSync(outDir, { recursive: true });

// Attach group- and phase-level prose to the descriptions that render it. A
// group taught as continuous text with no numbered chapters has its material
// here and nowhere else, so without this those groups are both empty and
// silent.
let groupIntrosApplied = 0;
let phaseIntrosApplied = 0;
let orphansTotalAttached = 0;
let orphansTotalDropped = 0;
for (const phase of phases) {
  for (const group of phase.groups) {
    const intro = groupIntros.get(`${phase.order}:${group.order}`);
    if (intro?.bodyMarkdown?.trim()) {
      group.description = appendBody(
        { bodyMarkdown: group.description ?? "" },
        intro.bodyMarkdown,
      ).bodyMarkdown;
      groupIntrosApplied += 1;
    }
  }
  const phaseIntro = phaseIntros.get(phase.order);
  if (phaseIntro?.bodyMarkdown?.trim()) {
    phase.description = appendBody(
      { bodyMarkdown: phase.description ?? "" },
      phaseIntro.bodyMarkdown,
    ).bodyMarkdown;
    phaseIntrosApplied += 1;
  }
  const phaseOrphan = phaseOrphans.get(phase.order);
  if (phaseOrphan?.bodyMarkdown?.trim()) {
    phase.description = appendBody(
      { bodyMarkdown: phase.description ?? "" },
      phaseOrphan.bodyMarkdown,
    ).bodyMarkdown;
    if (phaseOrphan.dropped) orphansTotalDropped += phaseOrphan.dropped;
    if (phaseOrphan.attached) orphansTotalAttached += phaseOrphan.attached;
  }
}
console.log(
  `  attached prose to ${groupIntrosApplied} group(s), ${phaseIntrosApplied} phase(s), and ${orphansTotalAttached} orphan segment(s)`,
  orphansTotalDropped ? ` (${orphansTotalDropped} truly unplaceable lines)` : "",
);

// A group with no topics and no prose renders as an expandable node a learner can
// open to find nothing. That reads as broken rather than empty, so drop those
// groups. A group that carries its own written introduction is not empty and is
// kept: Phase 7 declares sixteen groups whose material is taught as continuous
// prose under the group heading with no numbered chapters at all, and dropping
// them was silently deleting several hundred lines of teaching.
const emptyGroups = phases.flatMap((phase) =>
  phase.groups
    .filter((group) => group.topics.length === 0 && !(group.description ?? "").trim())
    .map((group) => `${phase.order}/${group.title}`),
);
for (const phase of phases) {
  phase.groups = phase.groups.filter(
    (group) => group.topics.length > 0 || (group.description ?? "").trim(),
  );
}
if (emptyGroups.length > 0) {
  console.log(`  dropped ${emptyGroups.length} empty group(s): ${emptyGroups.join(", ")}`);
}

const manifest = {
  structureSource: structureLabel,
  contentSources: expandedPaths.map((path) => path.replace(/\\/g, "/").split("/").pop()),
  generatedBy: "scripts/parse-roadmap.mjs",
  phases: phases.length,
  groups: phases.reduce((sum, p) => sum + p.groups.length, 0),
  topics: stats.topics,
  enrichedTopics: stats.enriched,
  interviewQuestions: stats.questions,
  practiceTasks: stats.practice,
};

for (const phase of phases) {
  const payload = serialisePhase(phase);
  writeFileSync(
    join(outDir, `phase-${String(phase.order).padStart(2, "0")}.json`),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
}

writeFileSync(
  join(outDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`,
  "utf8",
);

console.log(`Wrote ${phases.length} files to prisma/seed-data/`);
