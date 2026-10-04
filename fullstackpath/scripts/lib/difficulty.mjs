/**
 * Difficulty resolution for the roadmap.
 *
 * Kept in its own module so the precedence rules can be tested directly.
 * `scripts/parse-roadmap.mjs` is a script with side effects and cannot be
 * imported, which previously made these rules untestable.
 *
 * Precedence, highest first:
 *   1. an explicit marker on the topic itself
 *   2. an explicit marker on the topic's group heading
 *   3. the per-phase default table
 *   4. `UNKNOWN_PHASE_DIFFICULTY`, for a phase with none of the above
 */

export const DIFFICULTY_BY_MARK = {
  "\u{1F7E2}": "BEGINNER",
  "\u{1F7E1}": "INTERMEDIATE",
  "\u{1F534}": "ADVANCED",
  "\u{26AB}": "SENIOR",
};

export const DIFFICULTY_NAME = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  SENIOR: "Senior / Staff",
};

/**
 * Default difficulty for a phase whose own heading carries no marker.
 *
 * Only 19 of the 68 groups in the source document carry an explicit marker, so
 * without a default the remaining ~1,600 topics all collapse onto `BEGINNER`
 * and the difficulty filter becomes a no-op. These values were derived from the
 * source, not from phase ordering: for each phase the markers that *are* present
 * were counted, and the unmarked groups were read against them.
 *
 * Phases 14 and 15 are deliberately not treated as "hard because they are
 * late". They are process, behavioural and career material: the most
 * senior-sounding phases in the document and technically among the easiest, so
 * a level-based guess would label them wrongly.
 */
export const PHASE_DIFFICULTY_DEFAULT = {
  1: "BEGINNER", // process, logistics and communication; no technical depth
  2: "BEGINNER", // heading is explicitly (Beginner) in the source
  3: "INTERMEDIATE", // 4 of 6 marked groups are Intermediate; HTML/CSS/JS core sit with them
  4: "INTERMEDIATE", // React, state and routing are unmarked but professional-level
  5: "INTERMEDIATE", // 5 of 7 marked groups are Intermediate
  6: "INTERMEDIATE", // SQL/NoSQL fundamentals; Caching Layers is spot-fixed to Advanced
  7: "INTERMEDIATE", // conservative floor; three unmarked groups are spot-fixed to Advanced
  8: "INTERMEDIATE", // containerisation, CI/CD and cloud basics
  9: "INTERMEDIATE", // the testing frameworks themselves
  10: "INTERMEDIATE", // classic DSA is interview-intermediate
  11: "INTERMEDIATE", // patterns and styles; LLD is already marked Advanced
  12: "INTERMEDIATE", // 3 of 5 groups are Intermediate; Distributed stays Senior
  13: "INTERMEDIATE", // heading is explicitly (Intermediate) in the source
  14: "BEGINNER", // behavioural and culture; Seniority group is already marked Senior
  15: "BEGINNER", // job search, offers and career logistics
};

/**
 * Why each default was chosen, recorded so the table can be re-derived instead
 * of being taken on faith. "marked" counts groups carrying an explicit marker.
 */
export const PHASE_DIFFICULTY_EVIDENCE = {
  1: "0 marked groups. Process/communication topics; nothing to be senior about.",
  2: "Phase heading marked (Beginner).",
  3: "marked: 4 Intermediate, 2 Advanced. Unmarked HTML/CSS/JS Core align with the Intermediate four.",
  4: "marked: 1 Intermediate, 2 Advanced. Unmarked React/State/Routing are Intermediate.",
  5: "marked: 5 Intermediate, 2 Advanced. Unmarked Node/Express/REST are Intermediate.",
  6: "marked: 2 Intermediate, 1 Advanced. Unmarked SQL/NoSQL are Intermediate; Caching Layers spot-fixed up.",
  7: "marked: 1 Advanced. Unmarked Protocols/Auth/Vulnerables are uniformly demanding; spot-fixed up, floor left Intermediate.",
  8: "marked: 1 Intermediate, 3 Advanced. Unmarked Containerization/CI-CD/Cloud are Intermediate.",
  9: "marked: 1 Intermediate. Unit/Integration/E2E are Intermediate.",
  10: "marked: 1 Advanced (OS & Concurrency), 1 Intermediate. DS/Algorithms/Problem Solving are Intermediate.",
  11: "marked: 1 Intermediate, 1 Advanced. Patterns/Architectural Styles are Intermediate.",
  12: "marked: 3 Intermediate, 1 Advanced, 1 Senior. No unmarked groups; default matches the plurality.",
  13: "Phase heading marked (Intermediate).",
  14: "marked: 1 Senior. Behavioural and culture content is not technically demanding.",
  15: "0 marked groups. Career logistics; resume, negotiation and outreach.",
};

/**
 * Used when a phase is absent from the table, e.g. a phase beyond the roadmap
 * or one whose order failed to parse. Deliberately the most conservative value:
 * a learner is better served by an easy default they can filter past than by an
 * "Advanced" label they cannot see past.
 */
export const UNKNOWN_PHASE_DIFFICULTY = "BEGINNER";

/**
 * Read an explicit difficulty marker from a heading or topic title.
 *
 * Returns `null` when no marker is present, so callers can fall through to the
 * next level of precedence. A marker far from the start of the string is
 * ignored, so a topic that merely mentions a level in prose is not mislabelled.
 */
export function detectDifficulty(text) {
  if (typeof text !== "string" || text.length === 0) return null;
  for (const [mark, level] of Object.entries(DIFFICULTY_BY_MARK)) {
    const index = text.indexOf(mark);
    if (index !== -1 && index < 80) return level;
  }
  const lower = text.toLowerCase();
  if (lower.includes("(advanced)")) return "ADVANCED";
  if (lower.includes("(intermediate)")) return "INTERMEDIATE";
  if (lower.includes("(senior")) return "SENIOR";
  if (lower.includes("(beginner)")) return "BEGINNER";
  return null;
}

/** Phase difficulty: explicit heading marker, then the table, then the fallback. */
export function phaseDifficultyFor(phaseOrder, headingText) {
  return (
    detectDifficulty(headingText) ??
    PHASE_DIFFICULTY_DEFAULT[phaseOrder] ??
    UNKNOWN_PHASE_DIFFICULTY
  );
}

/** Group difficulty: explicit heading marker, then the phase's resolved value. */
export function groupDifficultyFor(headingText, phaseDifficulty) {
  return detectDifficulty(headingText) ?? phaseDifficulty;
}

/**
 * Topic difficulty: an explicit marker on the topic itself wins, then the
 * group's, then the phase's. A topic heading carries no marker in the current
 * source, so in practice this resolves to the group — which is the fix: topics
 * previously took the phase value and ignored their group's marker entirely.
 */
export function topicDifficultyFor(topicText, groupDifficulty, phaseDifficulty) {
  return detectDifficulty(topicText) ?? groupDifficulty ?? phaseDifficulty;
}