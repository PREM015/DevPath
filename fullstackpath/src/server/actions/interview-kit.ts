"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/permissions";
import { recordActivity } from "@/server/services/activity";
import type { ActionResult } from "@/server/actions/progress";

/**
 * Interview actions.
 *
 * The rule that matters: none of these change a topic's completion status.
 * Answering a question well, or failing a drill, tells you about your recall —
 * it does not mean you implemented the topic. Those stay separate so progress
 * numbers stay meaningful.
 */

const recordAttemptSchema = z.object({
  questionId: z.string().min(1).max(64),
  result: z.enum(["CONFIDENT", "PARTIAL", "BLANK"]),
  secondsSpent: z.number().int().min(0).max(3600).optional(),
});

const updateDrillSchema = z.object({
  blockId: z.string().min(1).max(64),
  status: z.enum(["NOT_STARTED", "ATTEMPTED", "PASSED", "NEEDS_WORK"]),
  notes: z.string().max(20_000).optional(),
});

const toggleChecklistSchema = z.object({
  blockId: z.string().min(1).max(64),
  index: z.number().int().min(0).max(200),
  done: z.boolean(),
});

const savePrepSchema = z.object({
  company: z.string().trim().max(120).optional(),
  role: z.string().trim().max(120).optional(),
  level: z.string().trim().max(60).optional(),
  interviewDate: z.string().datetime().optional(),
  notes: z.string().max(20_000).optional(),
});

/** Records how a candidate did on one question. */
export async function recordAttemptAction(
  input: z.infer<typeof recordAttemptSchema>,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = recordAttemptSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const question = await prisma.interviewQuestion.findUnique({
    where: { id: parsed.data.questionId },
    select: { id: true, text: true, topicId: true },
  });
  if (!question) return { ok: false, error: "That question no longer exists." };

  const now = new Date();
  const previous = await prisma.questionAttempt.findUnique({
    where: { userId_questionId: { userId: user.id, questionId: question.id } },
    select: { id: true, attempts: true, result: true },
  });

  await prisma.questionAttempt.upsert({
    where: { userId_questionId: { userId: user.id, questionId: question.id } },
    create: {
      userId: user.id,
      questionId: question.id,
      result: parsed.data.result,
      secondsSpent: parsed.data.secondsSpent ?? null,
      attempts: 1,
      lastAttemptAt: now,
    },
    update: {
      result: parsed.data.result,
      ...(parsed.data.secondsSpent !== undefined
        ? { secondsSpent: parsed.data.secondsSpent }
        : {}),
      attempts: (previous?.attempts ?? 0) + 1,
      lastAttemptAt: now,
    },
  });

  // A question answered confidently for the first time is worth an activity row:
  // it is a real milestone, and it is what feeds the "recent activity" list.
  if (parsed.data.result === "CONFIDENT" && previous?.result !== "CONFIDENT") {
    await recordActivity(user.id, {
      type: "QUESTION_ANSWERED",
      referenceId: question.id,
      metadata: { topicTitle: question.text.slice(0, 80) },
    });
  }

  revalidatePath("/interview");
  revalidatePath("/interview/questions");
  revalidatePath("/dashboard");

  return {
    ok: true,
    message: "Recorded.",
    data: { attempts: (previous?.attempts ?? 0) + 1, result: parsed.data.result },
  };
}

/** Records whether a practice block was cleared, attempted or needs work. */
export async function updateDrillAction(
  input: z.infer<typeof updateDrillSchema>,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = updateDrillSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const block = await prisma.practiceBlock.findUnique({
    where: { id: parsed.data.blockId },
    select: { id: true, title: true, kind: true },
  });
  if (!block) return { ok: false, error: "That practice block no longer exists." };

  const data = {
    status: parsed.data.status,
    ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
    completedAt: parsed.data.status === "PASSED" ? new Date() : null,
  };

  await prisma.drillResult.upsert({
    where: { userId_blockId: { userId: user.id, blockId: block.id } },
    create: { userId: user.id, blockId: block.id, ...data },
    update: data,
  });

  if (parsed.data.status === "PASSED") {
    await recordActivity(user.id, {
      type: "DRILL_PASSED",
      referenceId: block.id,
      metadata: { title: block.title },
    });
  }

  revalidatePath("/interview");
  revalidatePath("/interview/kit");
  revalidatePath("/dashboard");

  return { ok: true, message: "Saved." };
}

/** Ticks one item of a checklist block. */
export async function toggleBlockChecklistAction(
  input: z.infer<typeof toggleChecklistSchema>,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = toggleChecklistSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const existing = await prisma.drillResult.findUnique({
    where: { userId_blockId: { userId: user.id, blockId: parsed.data.blockId } },
    select: { id: true, checklistJson: true },
  });

  const current = (existing?.checklistJson as Record<string, boolean> | null) ?? {};
  const next = { ...current, [String(parsed.data.index)]: parsed.data.done };

  await prisma.drillResult.upsert({
    where: { userId_blockId: { userId: user.id, blockId: parsed.data.blockId } },
    create: { userId: user.id, blockId: parsed.data.blockId, checklistJson: next },
    update: { checklistJson: next },
  });

  revalidatePath("/interview/kit");
  return { ok: true, message: "Checklist updated." };
}

/** Stores the interview the candidate is preparing for, which drives the plan. */
export async function saveInterviewPrepAction(
  input: z.infer<typeof savePrepSchema>,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = savePrepSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const data = parsed.data;

  // A date in the past is almost always a typo, and a plan built on it is wrong.
  if (data.interviewDate) {
    const when = new Date(data.interviewDate);
    if (when.getTime() < Date.now() - 86_400_000) {
      return { ok: false, error: "That interview date is in the past." };
    }
  }

  const existing = await prisma.interviewPrep.findFirst({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  const payload = {
    company: data.company || null,
    role: data.role || null,
    level: data.level || null,
    interviewDate: data.interviewDate ? new Date(data.interviewDate) : null,
    notes: data.notes || null,
  };

  if (existing) {
    await prisma.interviewPrep.update({ where: { id: existing.id }, data: payload });
  } else {
    await prisma.interviewPrep.create({ data: { userId: user.id, ...payload } });
  }

  revalidatePath("/interview");
  revalidatePath("/dashboard");
  return { ok: true, message: "Interview saved." };
}
