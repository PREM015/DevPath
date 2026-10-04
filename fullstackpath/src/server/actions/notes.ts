"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/permissions";
import { deleteNoteSchema, upsertNoteSchema, type UpsertNoteInput } from "@/lib/validations/notes";
import { recordActivity } from "@/server/services/activity";
import { evaluateAchievements } from "@/server/services/achievements";
import type { ActionResult } from "@/server/actions/progress";

/**
 * Notes are private to their owner. Every mutation reads and writes through the
 * signed-in user's id, and the update/delete filters include `userId` so a
 * guessed id belonging to someone else matches nothing.
 */
export async function upsertNoteAction(input: UpsertNoteInput): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = upsertNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]!.message };
  }

  const { noteId, topicId, title, content, tags, isPinned } = parsed.data;

  // A topic reference must be real, otherwise notes would point at nothing.
  if (topicId) {
    const topic = await prisma.topic.findUnique({
      where: { id: topicId },
      select: { id: true, slug: true },
    });
    if (!topic) return { ok: false, error: "That topic no longer exists." };
  }

  if (noteId) {
    const updated = await prisma.userNote.updateMany({
      where: { id: noteId, userId: user.id },
      data: {
        title,
        content,
        ...(tags !== undefined ? { tagsJson: tags } : {}),
        ...(isPinned !== undefined ? { isPinned } : {}),
        ...(topicId !== undefined ? { topicId: topicId ?? null } : {}),
      },
    });

    if (updated.count === 0) return { ok: false, error: "That note was not found." };

    await recordActivity(user.id, { type: "NOTE_UPDATED", referenceId: noteId, metadata: { title } });
    revalidatePath("/notes");
    if (topicId) revalidatePath(`/roadmap/${(await topicSlug(topicId)) ?? ""}`);

    return { ok: true, message: "Note saved.", data: { noteId } };
  }

  const created = await prisma.userNote.create({
    data: {
      userId: user.id,
      title,
      content,
      topicId: topicId ?? null,
      tagsJson: tags ?? [],
      isPinned: isPinned ?? false,
    },
    select: { id: true },
  });

  await recordActivity(user.id, {
    type: "NOTE_CREATED",
    referenceId: created.id,
    metadata: { title },
  });
  await evaluateAchievements(user.id);

  revalidatePath("/notes");

  return { ok: true, message: "Note created.", data: { noteId: created.id } };
}

export async function deleteNoteAction(noteId: string): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = deleteNoteSchema.safeParse({ noteId });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const deleted = await prisma.userNote.deleteMany({
    where: { id: parsed.data.noteId, userId: user.id },
  });

  if (deleted.count === 0) return { ok: false, error: "That note was not found." };

  revalidatePath("/notes");
  return { ok: true, message: "Note deleted." };
}

export async function toggleNotePinAction(noteId: string): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const note = await prisma.userNote.findFirst({
    where: { id: noteId, userId: user.id },
    select: { id: true, isPinned: true },
  });
  if (!note) return { ok: false, error: "That note was not found." };

  await prisma.userNote.update({
    where: { id: note.id },
    data: { isPinned: !note.isPinned },
  });

  revalidatePath("/notes");
  return { ok: true, message: note.isPinned ? "Unpinned." : "Pinned." };
}

/** Exports every note the user owns as JSON. Never includes other users' notes. */
export async function exportNotesAction(): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const notes = await prisma.userNote.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      title: true,
      content: true,
      tagsJson: true,
      isPinned: true,
      createdAt: true,
      updatedAt: true,
      topic: { select: { slug: true, title: true } },
    },
  });

  const payload = {
    exportedAt: new Date().toISOString(),
    account: user.email,
    notes: notes.map((note) => ({
      title: note.title,
      content: note.content,
      tags: (note.tagsJson as string[] | null) ?? [],
      isPinned: note.isPinned,
      createdAt: note.createdAt.toISOString(),
      updatedAt: note.updatedAt.toISOString(),
      topic: note.topic,
    })),
  };

  revalidatePath("/notes");

  return {
    ok: true,
    message: `${notes.length} notes exported.`,
    data: { filename: "fullstackpath-notes.json", payload: JSON.stringify(payload, null, 2) },
  };
}

async function topicSlug(topicId: string): Promise<string | null> {
  const topic = await prisma.topic.findUnique({
    where: { id: topicId },
    select: { slug: true },
  });
  return topic?.slug ?? null;
}