"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/permissions";
import {
  endStudySessionSchema,
  reviewRevisionSchema,
  scheduleRevisionSchema,
  startStudySessionSchema,
  toggleBookmarkSchema,
  updateProgressSchema,
  type UpdateProgressInput,
} from "@/lib/validations/progress";
import {
  REVISION_QUALITY,
  DEFAULT_REVISION_INTERVALS,
  SELECTABLE_STATUSES,
} from "@/config";
import { recordActivity } from "@/server/services/activity";
import { evaluateAchievements } from "@/server/services/achievements";
import { startOfDayInTimezone } from "@/lib/utils/time";
import { addDays, startOfDay } from "date-fns";

export type ActionResult =
  | { ok: true; message: string; data?: Record<string, unknown> }
  | { ok: false; error: string };

const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: "Not started",
  IN_PROGRESS: "In progress",
  PRACTICED: "Practiced",
  COMPLETED: "Completed",
  NEEDS_REVISION: "Needs revision",
};

const SELECTABLE = new Set<string>(SELECTABLE_STATUSES.map((s) => s.value));

/**
 * Update the signed-in user's progress on a topic.
 *
 * Ownership is not a parameter: `userId` comes from the session, so there is no
 * code path by which one user can write another user's progress.
 */
export async function updateTopicProgress(
  input: UpdateProgressInput,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in to track progress." };
  }

  const parsed = updateProgressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }

  const { topicId, status, confidence, personalDifficulty } = parsed.data;

  if (!SELECTABLE.has(status)) {
    return { ok: false, error: "That status is not available. Use reset progress to clear a topic." };
  }

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { id: true, slug: true, title: true, isActive: true },
  });

  if (!topic) return { ok: false, error: "That topic no longer exists." };

  const now = new Date();
  const isCompletion = status === "COMPLETED";

  await prisma.$transaction(async (tx) => {
    const existing = await tx.userTopicProgress.findUnique({
      where: { userId_topicId: { userId: user.id, topicId } },
      select: { id: true, status: true, startedAt: true, completedAt: true },
    });

    if (!existing) {
      await tx.userTopicProgress.create({
        data: {
          userId: user.id,
          topicId,
          status,
          startedAt: now,
          completedAt: isCompletion ? now : null,
          lastStudiedAt: now,
          confidence: confidence ?? null,
          personalDifficulty: personalDifficulty ?? null,
        },
      });
      return;
    }

    await tx.userTopicProgress.update({
      where: { id: existing.id },
      data: {
        status,
        // startedAt is written once and preserved afterwards.
        startedAt: existing.startedAt ?? now,
        // Completion is reversible: clearing the status clears the date too.
        completedAt: isCompletion ? (existing.completedAt ?? now) : null,
        lastStudiedAt: now,
        ...(confidence !== undefined ? { confidence } : {}),
        ...(personalDifficulty !== undefined ? { personalDifficulty } : {}),
      },
    });
  });

  await recordActivity(user.id, {
    type: isCompletion
      ? "TOPIC_COMPLETED"
      : status === "PRACTICED"
        ? "TOPIC_PRACTICED"
        : status === "IN_PROGRESS"
          ? "TOPIC_STARTED"
          : "TOPIC_STARTED",
    referenceId: topicId,
    metadata: { topicTitle: topic.title, topicSlug: topic.slug, status },
  });

  await evaluateAchievements(user.id);

  revalidatePath("/dashboard");
  revalidatePath("/roadmap");
  revalidatePath(`/roadmap/${topic.slug}`);
  revalidatePath("/learning");
  revalidatePath("/analytics");

  return {
    ok: true,
    message: `Marked as ${STATUS_LABELS[status]?.toLowerCase() ?? status}.`,
    data: { status, completedAt: isCompletion ? now : null },
  };
}

/** Clear all progress on a topic, returning it to NOT_STARTED. */
export async function resetTopicProgress(topicId: string): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { slug: true },
  });
  if (!topic) return { ok: false, error: "That topic no longer exists." };

  // Deleting the row is the correct representation of "not started": the master
  // roadmap implies NOT_STARTED for every topic with no row, so nothing else has
  // to agree about a zero state.
  await prisma.userTopicProgress.deleteMany({ where: { userId: user.id, topicId } });

  await recordActivity(user.id, {
    type: "TOPIC_RESET",
    referenceId: topicId,
    metadata: { topicSlug: topic.slug },
  });

  revalidatePath("/dashboard");
  revalidatePath("/roadmap");
  revalidatePath("/learning");

  return { ok: true, message: "Progress reset to not started." };
}

/** Opens a study session. Time is accumulated later by endStudySession. */
export async function startStudySession(topicId?: string): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = startStudySessionSchema.safeParse({ topicId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const session = await prisma.studySession.create({
    data: { userId: user.id, topicId: parsed.data.topicId ?? null, startedAt: new Date() },
    select: { id: true },
  });

  return { ok: true, message: "Study session started.", data: { sessionId: session.id } };
}

/**
 * Closes a study session and folds the elapsed time into the topic's total.
 *
 * The session is scoped to the user on read, so one user cannot close another's
 * session even if they learn the id.
 */
export async function endStudySession(
  sessionId: string,
  minutes?: number,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = endStudySessionSchema.safeParse({ sessionId, minutes });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const session = await prisma.studySession.findFirst({
    where: { id: parsed.data.sessionId, userId: user.id },
    select: { id: true, topicId: true, startedAt: true, endedAt: true },
  });

  if (!session) return { ok: false, error: "That study session was not found." };
  if (session.endedAt) return { ok: true, message: "That session was already closed." };

  const elapsedMinutes = Math.max(
    1,
    Math.round((Date.now() - session.startedAt.getTime()) / 60_000),
  );
  // Cap a single session so an accidentally forgotten timer cannot inflate
  // totals beyond one working day.
  const durationMinutes = Math.min(elapsedMinutes, 16 * 60);

  const endedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.studySession.update({
      where: { id: session.id },
      data: { endedAt, durationMinutes },
    });

    if (session.topicId) {
      const progress = await tx.userTopicProgress.findUnique({
        where: { userId_topicId: { userId: user.id, topicId: session.topicId } },
        select: { id: true, status: true },
      });

      if (progress) {
        await tx.userTopicProgress.update({
          where: { id: progress.id },
          data: {
            totalTimeMinutes: { increment: durationMinutes },
            lastStudiedAt: endedAt,
          },
        });
      } else {
        // Studying a topic creates progress implicitly as IN_PROGRESS. This is
        // the only automatic status change, and it is not a completion.
        await tx.userTopicProgress.create({
          data: {
            userId: user.id,
            topicId: session.topicId,
            status: "IN_PROGRESS",
            startedAt: endedAt,
            lastStudiedAt: endedAt,
            totalTimeMinutes: durationMinutes,
          },
        });
      }
    }

    await tx.learningActivity.create({
      data: {
        userId: user.id,
        activityType: "STUDY_SESSION",
        referenceId: session.topicId,
        metadataJson: { durationMinutes },
        createdAt: endedAt,
      },
    });
  });

  revalidatePath("/dashboard");
  revalidatePath("/analytics");

  return { ok: true, message: "Session saved.", data: { durationMinutes } };
}

export async function toggleBookmark(topicId: string): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = toggleBookmarkSchema.safeParse({ topicId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const existing = await prisma.bookmark.findUnique({
    where: { userId_topicId: { userId: user.id, topicId } },
    select: { id: true },
  });

  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    await recordActivity(user.id, {
      type: "BOOKMARK_REMOVED",
      referenceId: topicId,
    });
    return { ok: true, message: "Bookmark removed.", data: { bookmarked: false } };
  }

  const topicExists = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { id: true },
  });
  if (!topicExists) return { ok: false, error: "That topic no longer exists." };

  await prisma.bookmark.create({ data: { userId: user.id, topicId } });
  await recordActivity(user.id, { type: "BOOKMARK_ADDED", referenceId: topicId });

  return { ok: true, message: "Topic bookmarked.", data: { bookmarked: true } };
}

/**
 * Adds a topic to the spaced-repetition schedule, or reschedules it.
 *
 * Completion is intentionally untouched: a topic is never completed by
 * scheduling it for revision.
 */
export async function scheduleRevision(topicId: string, delayDays?: number): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = scheduleRevisionSchema.safeParse({ topicId, delayDays });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { id: true, slug: true, title: true, isActive: true },
  });
  if (!topic) return { ok: false, error: "That topic no longer exists." };

  const delay = parsed.data.delayDays ?? DEFAULT_REVISION_INTERVALS[0];
  const nextReviewAt = addDays(new Date(), delay);

  await prisma.revision.upsert({
    where: { userId_topicId: { userId: user.id, topicId } },
    create: {
      userId: user.id,
      topicId,
      status: "SCHEDULED",
      nextReviewAt,
      intervalDays: delay,
      ladderIndex: 0,
      easeFactor: 2.5,
    },
    update: {
      status: "SCHEDULED",
      nextReviewAt,
      intervalDays: delay,
      reviewCount: 0,
      ladderIndex: 0,
      lastReviewedAt: null,
    },
  });

  revalidatePath("/revision");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: `Scheduled for review in ${delay} day${delay === 1 ? "" : "s"}.`,
  };
}

/** Removes a topic from the revision schedule. Progress is untouched. */
export async function removeRevision(topicId: string): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  await prisma.revision.deleteMany({ where: { userId: user.id, topicId } });
  revalidatePath("/revision");
  revalidatePath("/dashboard");

  return { ok: true, message: "Removed from revision schedule." };
}

/**
 * Records a review attempt and schedules the next one.
 *
 * Scheduling rule: the user has a configurable ladder of intervals (defaults
 * 1, 3, 7, 14, 30, 60, 120 days). A FORGOT answer restarts at the first step,
 * HARD drops back one step, GOOD advances one and EASY advances two. The
 * learner's own rating is the only input.
 */
export async function reviewTopic(
  topicId: string,
  result: "FORGOT" | "HARD" | "GOOD" | "EASY",
  minutes?: number,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = reviewRevisionSchema.safeParse({ topicId, result, minutes });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const revision = await prisma.revision.findUnique({
    where: { userId_topicId: { userId: user.id, topicId } },
    select: {
      id: true,
      intervalDays: true,
      reviewCount: true,
      easeFactor: true,
      ladderIndex: true,
    },
  });
  if (!revision) return { ok: false, error: "That topic is not in your revision schedule." };

  const ladder = await getRevisionLadder(user.id);
  const quality = REVISION_QUALITY[result];

  const currentIndex = revision.ladderIndex ?? 0;
  const nextIndex = Math.min(
    ladder.length - 1,
    Math.max(0, currentIndex + quality.ladderDelta),
  );
  const nextInterval = ladder[nextIndex]!;
  const nextEase = Math.min(3, Math.max(1.3, revision.easeFactor + quality.easeDelta));
  const nextReviewAt = addDays(startOfDay(new Date()), nextInterval);
  const nextStatus = nextReviewAt <= new Date() ? "DUE" : "SCHEDULED";

  const reviewedAt = new Date();

  await prisma.$transaction(async (tx) => {
    await tx.revision.update({
      where: { id: revision.id },
      data: {
        intervalDays: nextInterval,
        ladderIndex: nextIndex,
        easeFactor: nextEase,
        reviewCount: { increment: 1 },
        lastReviewedAt: reviewedAt,
        nextReviewAt,
        status: nextStatus,
      },
    });

    await tx.revisionHistory.create({
      data: {
        userId: user.id,
        topicId,
        result,
        reviewedAt,
        previousInterval: revision.intervalDays,
        nextInterval,
        easeFactor: nextEase,
        timeSpentSeconds: (parsed.data.minutes ?? 0) * 60,
      },
    });

    await tx.userTopicProgress.updateMany({
      where: { userId: user.id, topicId },
      data: { revisionCount: { increment: 1 }, lastStudiedAt: reviewedAt },
    });

    await tx.learningActivity.create({
      data: {
        userId: user.id,
        activityType: "TOPIC_REVISED",
        referenceId: topicId,
        metadataJson: { result, nextInterval },
        createdAt: reviewedAt,
      },
    });
  });

  await evaluateAchievements(user.id);

  revalidatePath("/revision");
  revalidatePath("/dashboard");
  revalidatePath("/analytics");

  return {
    ok: true,
    message: `Next review in ${nextInterval} day${nextInterval === 1 ? "" : "s"}.`,
    data: { nextReviewAt: nextReviewAt.toISOString(), nextInterval },
  };
}

/** Reschedules a topic for review right now (used by "review later"). */
export async function postponeRevision(topicId: string, days = 1): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const nextReviewAt = addDays(startOfDay(new Date()), Math.max(1, days));

  const updated = await prisma.revision.updateMany({
    where: { userId: user.id, topicId },
    data: { nextReviewAt, status: "SCHEDULED" },
  });

  if (updated.count === 0) return { ok: false, error: "That topic is not in your revision schedule." };

  revalidatePath("/revision");
  return { ok: true, message: `Postponed by ${days} day${days === 1 ? "" : "s"}.` };
}

/** Personalised spaced-repetition ladder for a user. */
export async function getRevisionLadder(userId: string): Promise<number[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { revisionIntervalsJson: true },
  });

  const custom = user?.revisionIntervalsJson as number[] | null | undefined;
  if (Array.isArray(custom) && custom.length > 0) {
    return custom.filter((value) => Number.isInteger(value) && value > 0);
  }
  return [...DEFAULT_REVISION_INTERVALS];
}

/** Today's local-day boundary for the signed-in user, used for streak maths. */
export async function getUserDayAnchor(userId: string): Promise<Date> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  return startOfDayInTimezone(user?.timezone ?? "UTC");
}