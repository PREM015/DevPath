"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireAdmin } from "@/lib/permissions";
import { slugify } from "@/lib/utils";
import type { ActionResult } from "@/server/actions/progress";

/**
 * Admin roadmap management.
 *
 * Two invariants hold for every action here:
 *
 *  1. Authorization is enforced on the server by requireAdmin(), never by the
 *     UI hiding a link.
 *  2. Content is upserted by slug and topics are never hard-deleted. Archiving
 *     sets isActive = false, which removes a topic from new users' roadmaps while
 *     keeping every existing progress row, note and study session intact. This is
 *     how "editing content must not destroy user progress" is actually enforced.
 */

const difficulty = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "SENIOR"]);

const phaseSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(4000),
  difficulty: difficulty.optional(),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #6366f1")
    .optional(),
  icon: z.string().trim().max(8).optional(),
  estimatedHours: z.number().int().min(0).max(2000).optional(),
});

const groupSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().min(2).max(4000),
  difficulty: difficulty.optional(),
  estimatedHours: z.number().int().min(0).max(2000).optional(),
});

const topicSchema = z.object({
  id: z.string().min(1).max(64),
  title: z.string().trim().min(2).max(200),
  description: z.string().trim().min(2).max(8000),
  difficulty: difficulty.optional(),
  estimatedMinutes: z.number().int().min(5).max(600).optional(),
});

const reorderSchema = z.object({
  kind: z.enum(["phase", "group"]),
  parentId: z.string().min(1).max(64).optional(),
  ids: z.array(z.string().min(1).max(64)).min(1).max(500),
});

/** Writes an audit row so content changes are attributable. */
async function audit(
  actor: { id: string; email: string },
  action: string,
  entityType: string,
  entityId: string | undefined,
  summary: string,
  metadata?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      entityType,
      entityId: entityId ?? null,
      summary,
      metadataJson: metadata as never,
    },
  });
}

export async function updatePhaseAction(input: z.infer<typeof phaseSchema>): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Administrator access required." };
  }

  const parsed = phaseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const existing = await prisma.phase.findUnique({
    where: { id: parsed.data.id },
    select: { slug: true, title: true },
  });
  if (!existing) return { ok: false, error: "That phase no longer exists." };

  await prisma.phase.update({
    where: { id: parsed.data.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      ...(parsed.data.difficulty ? { difficulty: parsed.data.difficulty } : {}),
      ...(parsed.data.color ? { color: parsed.data.color } : {}),
      ...(parsed.data.icon !== undefined ? { icon: parsed.data.icon || null } : {}),
      ...(parsed.data.estimatedHours !== undefined
        ? { estimatedHours: parsed.data.estimatedHours }
        : {}),
    },
  });

  await audit(admin, "phase.update", "Phase", parsed.data.id, `Updated phase "${parsed.data.title}"`);

  revalidatePath("/admin");
  revalidatePath("/roadmap");
  revalidatePath("/dashboard");
  return { ok: true, message: "Phase updated. Existing progress was not touched." };
}

export async function createPhaseAction(input: {
  title: string;
  description: string;
}): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Administrator access required." };
  }

  const parsed = z
    .object({
      title: z.string().trim().min(2).max(120),
      description: z.string().trim().min(2).max(4000),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  // Slugs are the stable identity used by progress, so a collision is resolved by
  // suffixing rather than by renaming an existing phase.
  const base = slugify(parsed.data.title) || "phase";
  let slug = base;
  let suffix = 2;
  while (await prisma.phase.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  const last = await prisma.phase.findFirst({ orderBy: { order: "desc" }, select: { order: true } });

  const created = await prisma.phase.create({
    data: {
      slug,
      title: parsed.data.title,
      description: parsed.data.description,
      order: (last?.order ?? 0) + 1,
      isActive: true,
    },
    select: { id: true },
  });

  await audit(admin, "phase.create", "Phase", created.id, `Created phase "${parsed.data.title}"`);

  revalidatePath("/admin");
  revalidatePath("/roadmap");
  return { ok: true, message: "Phase created.", data: { id: created.id, slug } };
}

export async function updateGroupAction(input: z.infer<typeof groupSchema>): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Administrator access required." };
  }

  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const existing = await prisma.roadmapGroup.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, title: true },
  });
  if (!existing) return { ok: false, error: "That group no longer exists." };

  await prisma.roadmapGroup.update({
    where: { id: parsed.data.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      ...(parsed.data.difficulty ? { difficulty: parsed.data.difficulty } : {}),
      ...(parsed.data.estimatedHours !== undefined
        ? { estimatedHours: parsed.data.estimatedHours }
        : {}),
    },
  });

  await audit(admin, "group.update", "RoadmapGroup", parsed.data.id, `Updated group "${parsed.data.title}"`);

  revalidatePath("/admin");
  revalidatePath("/roadmap");
  return { ok: true, message: "Group updated." };
}

export async function updateTopicAction(input: z.infer<typeof topicSchema>): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Administrator access required." };
  }

  const parsed = topicSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const existing = await prisma.topic.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, slug: true, title: true },
  });
  if (!existing) return { ok: false, error: "That topic no longer exists." };

  await prisma.topic.update({
    where: { id: parsed.data.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      ...(parsed.data.difficulty ? { difficulty: parsed.data.difficulty } : {}),
      ...(parsed.data.estimatedMinutes !== undefined
        ? { estimatedMinutes: parsed.data.estimatedMinutes }
        : {}),
    },
  });

  await audit(
    admin,
    "topic.update",
    "Topic",
    parsed.data.id,
    `Updated topic "${parsed.data.title}"`,
  );

  revalidatePath("/admin");
  revalidatePath("/roadmap");
  revalidatePath(`/roadmap/${existing.slug}`);
  return { ok: true, message: "Topic updated. User progress is unchanged." };
}

export async function createTopicAction(input: {
  groupId: string;
  title: string;
  description: string;
  difficulty?: string;
  estimatedMinutes?: number;
}): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Administrator access required." };
  }

  const parsed = z
    .object({
      groupId: z.string().min(1).max(64),
      title: z.string().trim().min(2).max(200),
      description: z.string().trim().min(2).max(8000),
      difficulty: difficulty.optional(),
      estimatedMinutes: z.number().int().min(5).max(600).optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const group = await prisma.roadmapGroup.findUnique({
    where: { id: parsed.data.groupId },
    select: { id: true, slug: true },
  });
  if (!group) return { ok: false, error: "That group no longer exists." };

  const base = `${group.slug}-${slugify(parsed.data.title) || "topic"}`;
  let slug = base;
  let suffix = 2;
  while (await prisma.topic.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${base}-${suffix}`;
    suffix += 1;
  }

  const last = await prisma.topic.findFirst({
    where: { groupId: group.id },
    orderBy: { order: "desc" },
    select: { order: true },
  });

  const created = await prisma.topic.create({
    data: {
      groupId: group.id,
      slug,
      title: parsed.data.title,
      description: parsed.data.description,
      difficulty: (parsed.data.difficulty ?? "BEGINNER") as never,
      estimatedMinutes: parsed.data.estimatedMinutes ?? 60,
      order: (last?.order ?? 0) + 1,
      isActive: true,
    },
    select: { id: true },
  });

  await audit(admin, "topic.create", "Topic", created.id, `Created topic "${parsed.data.title}"`);

  revalidatePath("/admin");
  revalidatePath("/roadmap");
  return { ok: true, message: "Topic created.", data: { id: created.id, slug } };
}

/**
 * Archives or restores a topic.
 *
 * Archiving is deliberately a soft delete: progress rows cascade only if a row is
 * hard-deleted, and archiving does not do that. That is what lets the roadmap
 * change without taking a learner's history with it.
 */
export async function setTopicArchivedAction(input: {
  topicId: string;
  archived: boolean;
}): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Administrator access required." };
  }

  const parsed = z
    .object({ topicId: z.string().min(1).max(64), archived: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const topic = await prisma.topic.findUnique({
    where: { id: parsed.data.topicId },
    select: { id: true, slug: true, title: true, isActive: true },
  });
  if (!topic) return { ok: false, error: "That topic no longer exists." };

  await prisma.topic.update({
    where: { id: topic.id },
    data: { isActive: !parsed.data.archived },
  });

  await audit(
    admin,
    parsed.data.archived ? "topic.archive" : "topic.restore",
    "Topic",
    topic.id,
    `${parsed.data.archived ? "Archived" : "Restored"} topic "${topic.title}". User progress preserved.`,
  );

  revalidatePath("/admin");
  revalidatePath("/roadmap");
  revalidatePath("/analytics");
  return {
    ok: true,
    message: parsed.data.archived
      ? "Topic archived. It is hidden from roadmaps but every user's progress is preserved."
      : "Topic restored.",
  };
}

/** Reorders phases or the groups within a phase. */
export async function reorderAction(input: z.infer<typeof reorderSchema>): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Administrator access required." };
  }

  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  const { kind, parentId, ids } = parsed.data;

  await prisma.$transaction(
    ids.map((id, index) =>
      kind === "phase"
        ? prisma.phase.update({ where: { id }, data: { order: index + 1 } })
        : prisma.roadmapGroup.update({
            where: { id },
            data: { order: index + 1, ...(parentId ? { phaseId: parentId } : {}) },
          }),
    ),
  );

  await audit(
    admin,
    `${kind}.reorder`,
    kind === "phase" ? "Phase" : "RoadmapGroup",
    parentId,
    `Reordered ${ids.length} ${kind}(s)`,
  );

  revalidatePath("/admin");
  revalidatePath("/roadmap");
  return { ok: true, message: "Order saved." };
}

/** Promotes or demotes a user. Demoting the last admin is refused. */
export async function setUserRoleAction(input: {
  userId: string;
  role: "USER" | "ADMIN";
}): Promise<ActionResult> {
  let admin;
  try {
    admin = await requireAdmin();
  } catch {
    return { ok: false, error: "Administrator access required." };
  }

  const parsed = z
    .object({ userId: z.string().min(1).max(64), role: z.enum(["USER", "ADMIN"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]!.message };

  if (parsed.data.userId === admin.id) {
    return { ok: false, error: "You cannot change your own role." };
  }

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, email: true, role: true },
  });
  if (!target) return { ok: false, error: "That user no longer exists." };

  if (target.role === "ADMIN" && parsed.data.role === "USER") {
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) {
      return { ok: false, error: "The last administrator cannot be demoted." };
    }
  }

  await prisma.user.update({ where: { id: target.id }, data: { role: parsed.data.role } });
  await audit(
    admin,
    "user.role",
    "User",
    target.id,
    `Set ${target.email} to ${parsed.data.role}`,
  );

  revalidatePath("/admin/users");
  return { ok: true, message: `${target.email} is now ${parsed.data.role}.` };
}