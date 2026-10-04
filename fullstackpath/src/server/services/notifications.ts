import "server-only";

import { prisma } from "@/lib/db/prisma";
import type { NotificationType } from "@/generated/prisma/enums";

/**
 * In-app notifications.
 *
 * Deliberately no push/email pipeline: notifications are rows the user reads in
 * the app. Nothing is generated speculatively — a notification is only created
 * when there is a real, scheduled event behind it.
 */
export async function createNotification(
  userId: string,
  notification: {
    type: NotificationType;
    title: string;
    body?: string;
    link?: string;
  },
): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      type: notification.type,
      title: notification.title,
      body: notification.body ?? null,
      link: notification.link ?? null,
    },
  });
}

/**
 * Creates "revision due" notifications for reviews whose date has arrived.
 *
 * Idempotent per (user, topic, review date): the same review does not generate a
 * second notification if this runs again later in the day.
 */
export async function syncRevisionNotifications(userId: string): Promise<void> {
  const now = new Date();
  const dayAhead = new Date(now.getTime() + 86_400_000);

  const [due, upcoming] = await Promise.all([
    prisma.revision.findMany({
      where: { userId, status: { in: ["DUE", "OVERDUE"] }, nextReviewAt: { lte: now } },
      select: {
        id: true,
        nextReviewAt: true,
        status: true,
        topic: { select: { title: true, slug: true } },
      },
      take: 20,
    }),
    prisma.revision.findMany({
      where: { userId, status: "SCHEDULED", nextReviewAt: { gt: now, lte: dayAhead } },
      select: {
        id: true,
        nextReviewAt: true,
        status: true,
        topic: { select: { title: true, slug: true } },
      },
      take: 20,
    }),
  ]);

  for (const revision of [...due, ...upcoming]) {
    const alreadySent = await prisma.notification.findFirst({
      where: {
        userId,
        type: "REVISION_DUE",
        link: `/roadmap/${revision.topic.slug}`,
        createdAt: { gte: new Date(revision.nextReviewAt.getTime() - 86_400_000) },
      },
      select: { id: true },
    });
    if (alreadySent) continue;

    const isDue = revision.nextReviewAt <= now;
    await createNotification(userId, {
      type: "REVISION_DUE",
      title: isDue
        ? `Revision due: ${revision.topic.title}`
        : `Revision tomorrow: ${revision.topic.title}`,
      body: isDue
        ? "This topic is scheduled for review today."
        : "This topic is scheduled for review tomorrow.",
      link: `/roadmap/${revision.topic.slug}`,
    });

    await prisma.revision.update({
      where: { id: revision.id },
      data: { status: isDue ? "DUE" : revision.status },
    });
  }
}

export async function getNotifications(userId: string, limit = 20) {
  const [rows, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  return { items: rows, unread };
}

export async function markNotificationsRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}