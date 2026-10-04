import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { ActivityType } from "@/generated/prisma/client";

/**
 * Activity log.
 *
 * Every meaningful learner action writes one row here. The dashboard and the
 * analytics page read exclusively from this table and from the progress tables,
 * so a metric can always be traced back to the events that produced it.
 */
export async function recordActivity(
  userId: string,
  event: {
    type: ActivityType;
    referenceId?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  },
): Promise<void> {
  await prisma.learningActivity.create({
    data: {
      userId,
      activityType: event.type,
      referenceId: event.referenceId ?? null,
      // Prisma's JSON input type is narrower than `Record<string, unknown>`;
      // metadata is always a flat scalar map here.
      metadataJson: event.metadata as never,
    },
  });
}

export type ActivityRow = {
  id: string;
  activityType: ActivityType;
  referenceId: string | null;
  createdAt: Date;
  topicTitle?: string;
  topicSlug?: string;
  projectTitle?: string;
};

export async function getRecentActivity(userId: string, limit = 12): Promise<ActivityRow[]> {
  const rows = await prisma.learningActivity.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      activityType: true,
      referenceId: true,
      createdAt: true,
      metadataJson: true,
    },
  });

  return rows.map((row) => {
    const metadata = (row.metadataJson as Record<string, string> | null) ?? {};
    return {
      id: row.id,
      activityType: row.activityType,
      referenceId: row.referenceId,
      createdAt: row.createdAt,
      topicTitle: metadata.topicTitle,
      topicSlug: metadata.topicSlug,
      projectTitle: metadata.projectTitle,
    };
  });
}

/**
 * Local day keys on which the user was active.
 *
 * "Active" means at least one of: a study session, a topic completion, a topic
 * revision, or a practice/completion action. Revisions and completions are
 * included because a learner can genuinely complete a topic without opening the
 * timer.
 */
export async function getActiveDayKeys(userId: string, timezone: string, sinceDays = 400) {
  const since = new Date(Date.now() - sinceDays * 86_400_000);

  const [sessions, completions, revisions] = await Promise.all([
    prisma.studySession.findMany({
      where: { userId, startedAt: { gte: since } },
      select: { startedAt: true },
    }),
    prisma.userTopicProgress.findMany({
      where: { userId, completedAt: { gte: since } },
      select: { completedAt: true },
    }),
    prisma.revisionHistory.findMany({
      where: { userId, reviewedAt: { gte: since } },
      select: { reviewedAt: true },
    }),
  ]);

  const { dayKeyInTimezone } = await import("@/lib/utils/time");

  const keys = new Set<string>();
  for (const row of sessions) keys.add(dayKeyInTimezone(row.startedAt, timezone));
  for (const row of completions) {
    if (row.completedAt) keys.add(dayKeyInTimezone(row.completedAt, timezone));
  }
  for (const row of revisions) keys.add(dayKeyInTimezone(row.reviewedAt, timezone));

  return Array.from(keys);
}