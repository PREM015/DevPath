import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Personal notes.
 *
 * Every read and write is scoped to `userId`, which only ever comes from the
 * server-side session. There is no query in this module that can return another
 * user's notes.
 */
export async function listNotes(
  userId: string,
  options: { query?: string; topicId?: string; tag?: string; limit?: number; offset?: number } = {},
) {
  const limit = Math.min(options.limit ?? 25, 100);
  const offset = options.offset ?? 0;

  const where = {
    userId,
    ...(options.topicId ? { topicId: options.topicId } : {}),
    ...(options.query
      ? {
          OR: [
            { title: { contains: options.query, mode: "insensitive" as const } },
            { content: { contains: options.query, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [rows, total, allTags] = await Promise.all([
    prisma.userNote.findMany({
      where,
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      skip: offset,
      take: limit,
      select: {
        id: true,
        title: true,
        content: true,
        tagsJson: true,
        isPinned: true,
        createdAt: true,
        updatedAt: true,
        topic: { select: { id: true, slug: true, title: true } },
      },
    }),
    prisma.userNote.count({ where }),
    prisma.userNote.findMany({
      where: { userId },
      select: { tagsJson: true },
    }),
  ]);

  const tags = new Set<string>();
  for (const row of allTags) {
    for (const tag of (row.tagsJson as string[] | null) ?? []) tags.add(tag);
  }

  const filtered =
    options.tag && tags.has(options.tag)
      ? rows.filter((row) => ((row.tagsJson as string[] | null) ?? []).includes(options.tag!))
      : rows;

  return {
    items: filtered.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      tags: (row.tagsJson as string[] | null) ?? [],
      isPinned: row.isPinned,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      topic: row.topic,
    })),
    total,
    tags: Array.from(tags).sort(),
    offset,
    limit,
  };
}

export async function getNote(userId: string, noteId: string) {
  return prisma.userNote.findFirst({
    where: { id: noteId, userId },
    select: {
      id: true,
      title: true,
      content: true,
      tagsJson: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
      topicId: true,
      topic: { select: { id: true, slug: true, title: true } },
    },
  });
}

/** Note counts used on the notes page header. */
export async function getNoteStats(userId: string) {
  const [total, pinned, rows] = await Promise.all([
    prisma.userNote.count({ where: { userId } }),
    prisma.userNote.count({ where: { userId, isPinned: true } }),
    prisma.userNote.findMany({
      where: { userId },
      select: { content: true },
    }),
  ]);

  const wordCount = rows.reduce(
    (sum, row) => sum + (row.content.trim() ? row.content.trim().split(/\s+/).length : 0),
    0,
  );

  return { total, pinned, wordCount };
}