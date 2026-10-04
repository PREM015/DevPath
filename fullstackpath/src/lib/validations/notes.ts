import { z } from "zod";
import { idSchema } from "./progress";

export const upsertNoteSchema = z.object({
  noteId: idSchema.optional(),
  topicId: idSchema.nullable().optional(),
  title: z.string().trim().min(1, "Title is required").max(200, "Title is too long"),
  content: z.string().max(100_000, "Note is too long").default(""),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).optional(),
  isPinned: z.boolean().optional(),
});

export const deleteNoteSchema = z.object({
  noteId: idSchema,
});

export type UpsertNoteInput = z.infer<typeof upsertNoteSchema>;