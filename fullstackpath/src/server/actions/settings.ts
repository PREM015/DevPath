"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireUser } from "@/lib/permissions";
import type { ActionResult } from "@/server/actions/progress";

const profileSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60).optional(),
  bio: z.string().trim().max(500).optional(),
  timezone: z.string().trim().min(1).max(64).optional(),
  preferredRole: z.enum(["FRONTEND", "BACKEND", "BALANCED", "STARTUP"]).optional(),
  targetLevel: z.enum(["JUNIOR", "MID", "SENIOR", "STAFF"]).optional(),
  dailyGoalMinutes: z.number().int().min(0, "0 minutes minimum").max(960).optional(),
  weeklyGoalMinutes: z.number().int().min(0).max(6720).optional(),
  revisionReminders: z.boolean().optional(),
  dailyGoalReminders: z.boolean().optional(),
  achievementNotifications: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  revisionIntervals: z
    .array(z.number().int().min(1).max(365))
    .min(1, "Keep at least one interval")
    .max(10)
    .optional(),
});

const avatarSchema = z.object({
  image: z
    .string()
    .trim()
    .max(500)
    .refine(
      (value) => value === "" || /^https:\/\//i.test(value),
      "Avatar URLs must use https://",
    ),
});

export async function updateProfileAction(
  input: z.infer<typeof profileSchema>,
): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const data = parsed.data;

  // Validate the timezone against the runtime's own database before saving it,
  // otherwise an invalid zone silently breaks streak calculations.
  if (data.timezone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: data.timezone }).format(new Date());
    } catch {
      return { ok: false, error: "That is not a recognised time zone." };
    }
  }

  if (
    data.dailyGoalMinutes !== undefined &&
    data.weeklyGoalMinutes !== undefined &&
    data.weeklyGoalMinutes < data.dailyGoalMinutes
  ) {
    return { ok: false, error: "Your weekly target cannot be smaller than your daily target." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.bio !== undefined ? { bio: data.bio || null } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(data.preferredRole !== undefined ? { preferredRole: data.preferredRole } : {}),
      ...(data.targetLevel !== undefined ? { targetLevel: data.targetLevel } : {}),
      ...(data.dailyGoalMinutes !== undefined ? { dailyGoalMinutes: data.dailyGoalMinutes } : {}),
      ...(data.weeklyGoalMinutes !== undefined ? { weeklyGoalMinutes: data.weeklyGoalMinutes } : {}),
      ...(data.revisionReminders !== undefined ? { revisionReminders: data.revisionReminders } : {}),
      ...(data.dailyGoalReminders !== undefined ? { dailyGoalReminders: data.dailyGoalReminders } : {}),
      ...(data.achievementNotifications !== undefined
        ? { achievementNotifications: data.achievementNotifications }
        : {}),
      ...(data.emailNotifications !== undefined ? { emailNotifications: data.emailNotifications } : {}),
      ...(data.revisionIntervals !== undefined
        ? { revisionIntervalsJson: data.revisionIntervals }
        : {}),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/revision");

  return { ok: true, message: "Settings saved." };
}

export async function updateAvatarAction(input: z.infer<typeof avatarSchema>): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const parsed = avatarSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  await prisma.user.update({
    where: { id: user.id },
    data: { image: parsed.data.image || null },
  });

  revalidatePath("/settings");
  return { ok: true, message: "Avatar updated." };
}

/**
 * Deletes the account and every row that belongs to it.
 *
 * Cascades in the schema remove progress, notes, sessions, revisions and
 * activity. A typed confirmation string is required so this cannot happen from a
 * stray click, and the guard below refuses to delete the last remaining admin.
 */
export async function deleteAccountAction(confirm: string): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  if (confirm !== "DELETE") {
    return { ok: false, error: "Type DELETE to confirm." };
  }

  if (user.role === "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      return {
        ok: false,
        error: "You are the only administrator. Promote another user before deleting your account.",
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.auditLog.create({
      data: {
        actorId: user.id,
        actorEmail: user.email,
        action: "account.delete",
        entityType: "User",
        entityId: user.id,
        summary: `User ${user.email} deleted their account`,
      },
    });
    await tx.user.delete({ where: { id: user.id } });
  });

  return { ok: true, message: "Your account and all its data have been deleted." };
}

/** Full export of everything the account owns, as a JSON string. */
export async function exportAccountAction(): Promise<ActionResult> {
  let user;
  try {
    user = await requireUser();
  } catch {
    return { ok: false, error: "You must be signed in." };
  }

  const [progress, notes, bookmarks, revisions, projects, sessions, activity, goals, achievements] =
    await Promise.all([
      prisma.userTopicProgress.findMany({
        where: { userId: user.id },
        select: {
          status: true,
          startedAt: true,
          completedAt: true,
          lastStudiedAt: true,
          totalTimeMinutes: true,
          confidence: true,
          personalDifficulty: true,
          topic: { select: { slug: true, title: true } },
        },
      }),
      prisma.userNote.findMany({
        where: { userId: user.id },
        select: { title: true, content: true, tagsJson: true, updatedAt: true, topic: { select: { slug: true } } },
      }),
      prisma.bookmark.findMany({
        where: { userId: user.id },
        select: { createdAt: true, topic: { select: { slug: true, title: true } } },
      }),
      prisma.revision.findMany({
        where: { userId: user.id },
        select: { nextReviewAt: true, intervalDays: true, reviewCount: true, easeFactor: true, topic: { select: { slug: true } } },
      }),
      prisma.userProjectProgress.findMany({
        where: { userId: user.id },
        select: { status: true, repositoryUrl: true, demoUrl: true, notes: true, completedAt: true, project: { select: { slug: true, title: true } } },
      }),
      prisma.studySession.findMany({
        where: { userId: user.id },
        select: { startedAt: true, endedAt: true, durationMinutes: true, topic: { select: { slug: true } } },
      }),
      prisma.learningActivity.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "asc" },
        select: { activityType: true, referenceId: true, createdAt: true },
      }),
      prisma.learningGoal.findMany({
        where: { userId: user.id },
        select: { title: true, target: true, current: true, deadline: true, status: true },
      }),
      prisma.userAchievement.findMany({
        where: { userId: user.id },
        select: { unlockedAt: true, achievement: { select: { slug: true, name: true } } },
      }),
    ]);

  const payload = JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      account: { email: user.email, name: user.name, role: user.role },
      progress,
      notes,
      bookmarks,
      revisions,
      projects,
      studySessions: sessions,
      activity,
      goals,
      achievements,
    },
    null,
    2,
  );

  return {
    ok: true,
    message: "Export ready.",
    data: { filename: "fullstackpath-export.json", payload },
  };
}