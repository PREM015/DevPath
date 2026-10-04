import { addDays, differenceInCalendarDays, format, startOfDay } from "date-fns";

/**
 * Day arithmetic is timezone-aware.
 *
 * A "learning day" must be a day in the learner's own timezone, otherwise a
 * session at 23:30 UTC counts for the wrong date for most of the world. All
 * streak and "today" calculations route through these helpers.
 */

/** `YYYY-MM-DD` key for a date in the given IANA timezone. */
export function dayKeyInTimezone(date: Date, timezone: string): string {
  try {
    // en-CA formats as YYYY-MM-DD, which sorts and compares correctly.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    return format(date, "yyyy-MM-dd");
  }
}

/** The user's local midnight for the given instant. */
export function startOfDayInTimezone(timezone: string, from: Date = new Date()): Date {
  const key = dayKeyInTimezone(from, timezone);
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year!, month! - 1, day, 0, 0, 0, 0);
}

/** Local day key for "today" in the user's timezone. */
export function todayKey(timezone: string, from: Date = new Date()): string {
  return dayKeyInTimezone(from, timezone);
}

/** The last `count` local day keys, oldest first, ending today. */
export function recentDayKeys(timezone: string, count: number, from: Date = new Date()): string[] {
  const today = startOfDayInTimezone(timezone, from);
  return Array.from({ length: count }, (_, index) =>
    dayKeyInTimezone(addDays(today, index - count + 1), timezone),
  );
}

export type StreakSummary = {
  current: number;
  longest: number;
  activeDays: number;
  lastActiveDay: string | null;
};

/**
 * Current and longest streak from a set of active day keys.
 *
 * Definition (documented so the number on the dashboard is unambiguous):
 *   - a day is "active" if the user logged at least one study session, completed
 *     a topic, or reviewed a topic on that local calendar day;
 *   - several sessions on one day still count as one day;
 *   - the current streak counts consecutive active days ending today or
 *     yesterday (so a streak does not break before the user has had a chance to
 *     study today);
 *   - the longest streak is the longest run of consecutive active days ever.
 */
export function calculateStreaks(dayKeys: string[], todayKey: string): StreakSummary {
  if (dayKeys.length === 0) {
    return { current: 0, longest: 0, activeDays: 0, lastActiveDay: null };
  }

  const unique = Array.from(new Set(dayKeys)).sort();
  const activeDays = unique.length;

  // Longest run of consecutive days.
  let longest = 1;
  let run = 1;
  for (let i = 1; i < unique.length; i += 1) {
    const previous = unique[i - 1]!;
    const current = unique[i]!;
    const diff = differenceInCalendarDays(new Date(current), new Date(previous));
    if (diff === 1) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  // Current streak: walk backwards from today (or yesterday if today is not yet
  // active) for as long as days are consecutive.
  const set = new Set(unique);
  const today = new Date(todayKey);
  let cursor = set.has(todayKey) ? today : addDays(today, -1);

  let current = 0;
  while (set.has(format(cursor, "yyyy-MM-dd"))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  return {
    current,
    longest: Math.max(longest, current),
    activeDays,
    lastActiveDay: unique[unique.length - 1] ?? null,
  };
}

export { addDays, startOfDay, differenceInCalendarDays };