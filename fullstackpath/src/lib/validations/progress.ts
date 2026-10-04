import { z } from "zod";

export const PROGRESS_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "PRACTICED",
  "COMPLETED",
  "NEEDS_REVISION",
] as const;

export const progressStatusSchema = z.enum(PROGRESS_STATUSES);
export type ProgressStatusValue = z.infer<typeof progressStatusSchema>;

export const idSchema = z.string().min(1).max(64);

export const updateProgressSchema = z.object({
  topicId: idSchema,
  status: progressStatusSchema,
  confidence: z.number().int().min(1).max(5).nullable().optional(),
  personalDifficulty: z.number().int().min(1).max(5).nullable().optional(),
});

export const startStudySessionSchema = z.object({
  topicId: idSchema.optional(),
});

export const endStudySessionSchema = z.object({
  sessionId: idSchema,
  minutes: z.number().int().min(0).max(24 * 60).optional(),
});

export const toggleBookmarkSchema = z.object({
  topicId: idSchema,
});

export const scheduleRevisionSchema = z.object({
  topicId: idSchema,
  /** Days until the first review. Defaults to 1 day per the documented ladder. */
  delayDays: z.number().int().min(0).max(365).optional(),
});

export const reviewRevisionSchema = z.object({
  topicId: idSchema,
  result: z.enum(["FORGOT", "HARD", "GOOD", "EASY"]),
  minutes: z.number().int().min(0).max(600).optional(),
});

export const updateRevisionSettingsSchema = z.object({
  intervals: z.array(z.number().int().min(1).max(365)).min(1).max(10),
});

export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;
export type StartStudySessionInput = z.infer<typeof startStudySessionSchema>;
export type EndStudySessionInput = z.infer<typeof endStudySessionSchema>;
export type ReviewRevisionInput = z.infer<typeof reviewRevisionSchema>;