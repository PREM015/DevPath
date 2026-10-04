"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/permissions";
import { recordActivity } from "@/server/services/activity";
import { evaluateAchievements } from "@/server/services/achievements";
import type { ActionResult } from "@/server/actions/progress";

const updateProjectSchema = z.object({
  projectId: z.string().min(1).max(64),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETED", "ABANDONED"]).optional(),
  repositoryUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value === "" || /^https?:\/\//i.test(value),
      "Enter a full URL starting with http:// or https://",
    )
    .optional(),
  demoUrl: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value === "" || /^https?:\/\//i.test(value),
      "Enter a full URL starting with http:// or https://",
    )
    .optional(),
  notes: z.string().max(20_000).optional(),
});

const toggleChecklistSchema = z.object({
  projectId: z.string().min(1).max(64),
  index: z.number().int().min(0).max(200),
  done: z.boolean(),
});

/** Only http(s) links are accepted, so a note can never inject a `javascript:` URL. */
function sanitizeUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return /^https?:\/\//i.test(trimmed) ? trimmed : null;
}

export async function updateProjectAction(
  input: z.infer<typeof updateProjectSchema>,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = updateProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const { projectId, status, repositoryUrl, demoUrl, notes } = parsed.data;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, slug: true, title: true },
  });
  if (!project) return { ok: false, error: "That project no longer exists." };

  const existing = await prisma.userProjectProgress.findUnique({
    where: { userId_projectId: { userId: user.id, projectId } },
    select: { id: true },
  });

  const data = {
    ...(status !== undefined ? { status } : {}),
    ...(repositoryUrl !== undefined ? { repositoryUrl: sanitizeUrl(repositoryUrl) } : {}),
    ...(demoUrl !== undefined ? { demoUrl: sanitizeUrl(demoUrl) } : {}),
    ...(notes !== undefined ? { notes } : {}),
    ...(status === "COMPLETED"
      ? { completedAt: new Date() }
      : status === "NOT_STARTED"
        ? { completedAt: null }
        : {}),
  };

  if (existing) {
    await prisma.userProjectProgress.update({ where: { id: existing.id }, data });
  } else {
    await prisma.userProjectProgress.create({
      data: { userId: user.id, projectId, ...data },
    });
  }

  if (status && status !== "NOT_STARTED") {
    await recordActivity(user.id, {
      type: status === "COMPLETED" ? "PROJECT_COMPLETED" : "PROJECT_STARTED",
      referenceId: projectId,
      metadata: { projectTitle: project.title },
    });
    await evaluateAchievements(user.id);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${project.slug}`);
  revalidatePath("/dashboard");

  return { ok: true, message: "Project updated." };
}

export async function toggleProjectChecklistAction(
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

  const { projectId, index, done } = parsed.data;

  const [project, existing] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { slug: true } }),
    prisma.userProjectProgress.findUnique({
      where: { userId_projectId: { userId: user.id, projectId } },
      select: { id: true, checklistJson: true },
    }),
  ]);

  if (!project) return { ok: false, error: "That project no longer exists." };

  const current = (existing?.checklistJson as Record<string, boolean> | null) ?? {};
  const next = { ...current, [String(index)]: done };

  if (existing) {
    await prisma.userProjectProgress.update({
      where: { id: existing.id },
      data: { checklistJson: next },
    });
  } else {
    await prisma.userProjectProgress.create({
      data: { userId: user.id, projectId, checklistJson: next },
    });
  }

  revalidatePath(`/projects/${project.slug}`);
  return { ok: true, message: "Checklist updated." };
}