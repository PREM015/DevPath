"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/permissions";
import { recordActivity } from "@/server/services/activity";
import type { ActionResult } from "@/server/actions/progress";

const mockInterviewSchema = z.object({
  title: z.string().trim().min(1, "Give the interview a title").max(120),
  company: z.string().trim().max(120).optional(),
  round: z.string().trim().max(120).optional(),
  kind: z.enum(["CODING", "SYSTEM_DESIGN", "BEHAVIORAL", "MOCK", "SCREENING", "OTHER"]),
  outcome: z.enum(["PASSED", "FAILED", "PENDING", "OFFER"]).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  durationMinutes: z.number().int().min(0).max(600).optional(),
  notes: z.string().max(20_000).optional(),
  performedAt: z.string().datetime().optional(),
});

const deleteMockInterviewSchema = z.object({
  id: z.string().min(1).max(64),
});

/**
 * Mock interview log.
 *
 * Recording an interview never changes topic progress: how well you did in an
 * interview is a fact about the interview, not a roadmap status.
 */
export async function logMockInterviewAction(
  input: z.infer<typeof mockInterviewSchema>,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = mockInterviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const data = parsed.data;

  const created = await prisma.mockInterview.create({
    data: {
      userId: user.id,
      title: data.title,
      company: data.company || null,
      round: data.round || null,
      kind: data.kind,
      outcome: data.outcome ?? null,
      difficulty: data.difficulty ?? null,
      durationMinutes: data.durationMinutes ?? null,
      notes: data.notes || null,
      performedAt: data.performedAt ? new Date(data.performedAt) : new Date(),
    },
    select: { id: true },
  });

  await recordActivity(user.id, {
    type: "MOCK_INTERVIEW_LOGGED",
    referenceId: created.id,
    metadata: { title: data.title },
  });

  revalidatePath("/interview");
  return { ok: true, message: "Interview logged.", data: { id: created.id } };
}

export async function deleteMockInterviewAction(id: string): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = deleteMockInterviewSchema.safeParse({ id });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const deleted = await prisma.mockInterview.deleteMany({
    where: { id: parsed.data.id, userId: user.id },
  });

  if (deleted.count === 0) return { ok: false, error: "That entry was not found." };

  revalidatePath("/interview");
  return { ok: true, message: "Entry deleted." };
}