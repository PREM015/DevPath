import { NextResponse } from "next/server";
import { z } from "zod";
import { getGroupsForPhase } from "@/server/services/roadmap";
import { getCurrentUser } from "@/lib/permissions";
import { prisma } from "@/lib/db/prisma";
import { rateLimit, clientKey, RATE_LIMITS } from "@/lib/utils/rate-limit";

const paramsSchema = z.object({ phaseId: z.string().min(1).max(64) });

/**
 * Groups of a phase, with the caller's own completion counts.
 *
 * Loaded on demand when a phase node is expanded on the canvas: this is the
 * progressive-rendering boundary that keeps the roadmap usable even with hundreds
 * of topics.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ phaseId: string }> },
) {
  const limit = rateLimit(clientKey(request, "roadmap-groups"), RATE_LIMITS.search.limit, RATE_LIMITS.search.windowMs);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid phase." }, { status: 400 });
  }

  const user = await getCurrentUser();
  const userId = user?.id;

  const phase = await prisma.phase.findFirst({
    where: { id: parsed.data.phaseId, isActive: true },
    select: {
      id: true,
      title: true,
      description: true,
      order: true,
      color: true,
      icon: true,
      difficulty: true,
      estimatedHours: true,
      objectivesJson: true,
    },
  });

  if (!phase) return NextResponse.json({ error: "Phase not found." }, { status: 404 });

  const groups = await getGroupsForPhase(phase.id);

  // Completion counts need one extra query over the phase's topics, scoped to the
  // caller. Grouped in memory rather than issuing one query per group (N+1).
  const topics = await prisma.topic.findMany({
    where: { group: { phaseId: phase.id }, isActive: true },
    select: {
      id: true,
      groupId: true,
      ...(userId
        ? { userProgress: { where: { userId }, select: { status: true }, take: 1 } }
        : {}),
    },
  });

  const completedByGroup = new Map<string, number>();
  const totalByGroup = new Map<string, number>();
  for (const topic of topics) {
    totalByGroup.set(topic.groupId, (totalByGroup.get(topic.groupId) ?? 0) + 1);
    const status = "userProgress" in topic ? topic.userProgress[0]?.status : undefined;
    if (status === "COMPLETED") {
      completedByGroup.set(topic.groupId, (completedByGroup.get(topic.groupId) ?? 0) + 1);
    }
  }

  return NextResponse.json(
    {
      phase: {
        ...phase,
        objectives: (phase.objectivesJson as string[] | null) ?? [],
      },
      groups: groups.map((group) => ({
        ...group,
        totalCount: totalByGroup.get(group.id) ?? group.topicCount,
        completedCount: completedByGroup.get(group.id) ?? 0,
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}