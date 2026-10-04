"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/permissions";
import type { ActionResult } from "@/server/actions/progress";

/**
 * The user's personal study queue.
 *
 * A queue entry is a reference to a topic plus an order. It never mutates the
 * master roadmap, so two users can queue the same topic differently and one
 * user's queue cannot affect another's.
 */

export async function addToQueueAction(topicId: string): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { id: true, slug: true, title: true },
  });
  if (!topic) return { ok: false, error: "That topic no longer exists." };

  const last = await prisma.userQueueItem.findFirst({
    where: { userId: user.id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  await prisma.userQueueItem.upsert({
    where: { userId_topicId: { userId: user.id, topicId } },
    create: { userId: user.id, topicId, sortOrder: (last?.sortOrder ?? 0) + 1 },
    update: {},
  });

  revalidatePath("/learning");
  return { ok: true, message: `Added "${topic.title}" to your queue.` };
}

export async function removeFromQueueAction(topicId: string): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  await prisma.userQueueItem.deleteMany({ where: { userId: user.id, topicId } });
  revalidatePath("/learning");
  return { ok: true, message: "Removed from your queue." };
}

/** Replaces the whole queue order in one transaction. */
export async function reorderQueueAction(topicIds: string[]): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  if (topicIds.length > 500) {
    return { ok: false, error: "That queue is too large to reorder." };
  }

  const owned = await prisma.userQueueItem.findMany({
    where: { userId: user.id },
    select: { topicId: true },
  });
  const ownedIds = new Set(owned.map((row) => row.topicId));

  // Only ids already in this user's queue may be reordered, so the action cannot
  // be used to write another user's queue.
  if (topicIds.some((id) => !ownedIds.has(id))) {
    return { ok: false, error: "That topic is not in your queue." };
  }

  await prisma.$transaction(
    topicIds.map((topicId, index) =>
      prisma.userQueueItem.update({
        where: { userId_topicId: { userId: user.id, topicId } },
        data: { sortOrder: index + 1 },
      }),
    ),
  );

  revalidatePath("/learning");
  return { ok: true, message: "Queue reordered." };
}