export const APP_NAME = "FullStackPath";
export const APP_DESCRIPTION =
  "Your complete journey from Beginner to Staff Engineer. One structured roadmap, every essential skill, and your progress tracked from day one.";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const PHASE_COUNT = 15;

export const DIFFICULTY_LEVELS = [
  { value: "BEGINNER", label: "Beginner", badge: "diff-beginner", dot: "bg-green-500" },
  { value: "INTERMEDIATE", label: "Intermediate", badge: "diff-intermediate", dot: "bg-yellow-500" },
  { value: "ADVANCED", label: "Advanced", badge: "diff-advanced", dot: "bg-red-500" },
  { value: "SENIOR", label: "Senior / Staff", badge: "diff-senior", dot: "bg-purple-500" },
] as const;

export const PROGRESS_STATUSES = [
  { value: "NOT_STARTED", label: "Not started", short: "Not started" },
  { value: "IN_PROGRESS", label: "In progress", short: "In progress" },
  { value: "PRACTICED", label: "Practiced", short: "Practiced" },
  { value: "COMPLETED", label: "Completed", short: "Completed" },
  { value: "NEEDS_REVISION", label: "Needs revision", short: "Needs revision" },
] as const;

/**
 * Selectable statuses on a topic. NOT_STARTED is reachable through "reset
 * progress" instead of being a target, so the status picker cannot be used to
 * silently clear a topic.
 */
export const SELECTABLE_STATUSES = PROGRESS_STATUSES.filter(
  (status) => status.value !== "NOT_STARTED",
);

export const LEARNER_ROLES = [
  {
    value: "FRONTEND",
    label: "Frontend-leaning",
    description: "UI engineering, browser platform, React and CSS depth.",
  },
  {
    value: "BACKEND",
    label: "Backend-leaning",
    description: "APIs, data stores, infrastructure and reliability.",
  },
  {
    value: "BALANCED",
    label: "Balanced full stack",
    description: "Equal depth across the frontend and backend halves.",
  },
  {
    value: "STARTUP",
    label: "Startup generalist",
    description: "Breadth, shipping speed and wearing many hats.",
  },
] as const;

export const TARGET_LEVELS = [
  { value: "JUNIOR", label: "Junior", description: "0-2 years" },
  { value: "MID", label: "Mid-level", description: "2-5 years" },
  { value: "SENIOR", label: "Senior", description: "5+ years" },
  { value: "STAFF", label: "Staff engineer", description: "Staff / principal" },
] as const;

/**
 * Default spaced-repetition ladder in days. Users may override this on their
 * profile; the ladder is stored per user, never globally.
 */
export const DEFAULT_REVISION_INTERVALS = [1, 3, 7, 14, 30, 60, 120] as const;

/** A review answer's effect on the ladder index. */
export const REVISION_QUALITY = {
  FORGOT: { easeDelta: -0.2, ladderDelta: -2, label: "Forgot it" },
  HARD: { easeDelta: -0.15, ladderDelta: -1, label: "Barely recalled" },
  GOOD: { easeDelta: 0, ladderDelta: 1, label: "Recalled it" },
  EASY: { easeDelta: 0.15, ladderDelta: 2, label: "Instant recall" },
} as const;

export const PROJECT_DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED", "SENIOR"] as const;

/**
 * Roadmap content stats shown on the landing page.
 *
 * These are counts of shipped roadmap content, not user or success metrics.
 * They are imported from the canonical content module so the page cannot drift
 * away from what is actually seeded.
 */
export const ROADMAP_STATS = {
  phases: PHASE_COUNT,
  projects: 8,
} as const;