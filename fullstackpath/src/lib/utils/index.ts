import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatRelativeTime(
  date: Date | string | null | undefined,
): string {
  if (!date) return "—";
  const then = new Date(date).getTime();
  const diff = Date.now() - then;

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(diff / 3_600_000);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diff / 86_400_000);
  if (days < 30) return `${days}d ago`;

  return formatDate(date);
}

/** Formats a minute count as a compact human duration, e.g. "2h 15m". */
export function formatDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";
  const total = Math.round(minutes);
  if (total < 60) return `${total}m`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/** Formats minutes as decimal hours, e.g. 135 -> "2.3h". */
export function minutesToHours(minutes: number): number {
  return Math.round((minutes / 60) * 10) / 10;
}

export function pluralize(
  count: number,
  singular: string,
  plural?: string,
): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ─────────────────────────────────────────────
// Presentation helpers
// ─────────────────────────────────────────────

export const DIFFICULTY_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  SENIOR: "Senior / Staff",
};

export const DIFFICULTY_BADGE_CLASSES: Record<string, string> = {
  BEGINNER:
    "text-green-400 bg-green-400/10 border-green-400/20 dark:text-green-300",
  INTERMEDIATE:
    "text-yellow-600 bg-yellow-500/10 border-yellow-500/20 dark:text-yellow-300",
  ADVANCED: "text-red-400 bg-red-400/10 border-red-400/20 dark:text-red-300",
  SENIOR:
    "text-purple-400 bg-purple-400/10 border-purple-400/20 dark:text-purple-300",
};

export function getDifficultyColor(difficulty: string): string {
  return DIFFICULTY_BADGE_CLASSES[difficulty] ?? DIFFICULTY_BADGE_CLASSES.BEGINNER!;
}

export function getDifficultyLabel(difficulty: string): string {
  return DIFFICULTY_LABELS[difficulty] ?? difficulty;
}

export const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  PRACTICED: "Practiced",
  COMPLETED: "Completed",
  NEEDS_REVISION: "Needs Revision",
  BLOCKED: "Blocked",
};

export const STATUS_BADGE_CLASSES: Record<string, string> = {
  NOT_STARTED: "text-neutral-500 bg-neutral-500/10 border-neutral-500/20",
  IN_PROGRESS: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  PRACTICED: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20",
  COMPLETED: "text-green-400 bg-green-400/10 border-green-400/20",
  NEEDS_REVISION: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  BLOCKED: "text-red-400 bg-red-400/10 border-red-400/20",
};

export function getProgressStatusColor(status: string): string {
  return STATUS_BADGE_CLASSES[status] ?? STATUS_BADGE_CLASSES.NOT_STARTED!;
}

export function getProgressStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function calculateCompletionPercentage(
  completed: number,
  total: number,
): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

// ─────────────────────────────────────────────
// Misc
// ─────────────────────────────────────────────

/** Cryptographically random URL-safe token. */
export function generateToken(bytes = 32): string {
  const array = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(array);
  return Array.from(array, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Six digit numeric code for email verification. */
export function generateVerificationCode(): string {
  const array = new Uint32Array(1);
  globalThis.crypto.getRandomValues(array);
  return String(array[0] % 1_000_000).padStart(6, "0");
}

export function initials(name: string | null | undefined, fallback = "?"): string {
  const source = (name ?? "").trim();
  if (!source) return fallback;
  const parts = source.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || fallback;
}

/** Stable, collision-resistant-ish slug with a short suffix for uniqueness. */
export function uniqueSlug(title: string): string {
  return `${slugify(title)}-${nanoidSuffix()}`;
}

function nanoidSuffix(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = new Uint8Array(6);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(
    bytes,
    (b) => alphabet[b % alphabet.length],
  ).join("");
}