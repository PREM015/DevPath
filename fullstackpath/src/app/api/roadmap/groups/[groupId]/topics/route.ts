import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { rateLimit, clientKey, RATE_LIMITS } from "@/lib/utils/rate-limit";

const paramsSchema = z.object({ groupId: z.string().min(1).max(64) });

/**
 * Topics of a group plus their prerequisite edges.
 *
 * The edge list is returned with the topics so the canvas can draw prerequisite
 * links without a second round trip when a group is expanded.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ groupId: string }> },
) {
  const limit = rateLimit(clientKey(request, "roadmap-group-topics"), RATE_LIMITS.search.limit, RATE_LIMITS.search.windowMs);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid group." }, { status: 400 });
  }

  const user = await getCurrentUser();
  const userId = user?.id;

  const group = await prisma.roadmapGroup.findFirst({
    where: { id: parsed.data.groupId, isActive: true },
    select: {
      id: true,
      title: true,
      description: true,
      order: true,
      difficulty: true,
      estimatedHours: true,
      objectivesJson: true,
      phase: {
        select: { id: true, title: true, order: true, color: true },
      },
    },
  });

  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  const topics = await prisma.topic.findMany({
    where: { groupId: group.id, isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      difficulty: true,
      estimatedMinutes: true,
      prerequisites: { select: { prerequisiteTopicId: true } },
      ...(userId
        ? { userProgress: { where: { userId }, select: { status: true }, take: 1 } }
        : {}),
    },
  });

  // Prerequisite edges restricted to the topics in this group plus their
  // prerequisites, so a link is only drawn when its target is visible.
  const visibleIds = new Set(topics.map((topic) => topic.id));
  const prerequisiteIds = new Set<string>();
  for (const topic of topics) {
    for (const prerequisite of topic.prerequisites) {
      prerequisiteIds.add(prerequisite.prerequisiteTopicId);
    }
  }

  const prerequisiteDetails =
    prerequisiteIds.size > 0
      ? await prisma.topic.findMany({
          where: { id: { in: Array.from(prerequisiteIds) } },
          select: {
            id: true,
            slug: true,
            title: true,
            isActive: true,
            ...(userId
              ? { userProgress: { where: { userId }, select: { status: true }, take: 1 } }
              : {}),
          },
        })
      : [];

  const prerequisiteMap = new Map(
    prerequisiteDetails.map((topic) => [
      topic.id,
      {
        id: topic.id,
        slug: topic.slug,
        title: topic.title,
        isArchived: !topic.isActive,
        status:
          ("userProgress" in topic ? topic.userProgress[0]?.status : undefined) ??
          "NOT_STARTED",
      },
    ]),
  );

  const edges = topics.flatMap((topic) =>
    topic.prerequisites
      .filter((prerequisite) => prerequisiteMap.has(prerequisite.prerequisiteTopicId))
      .map((prerequisite) => ({
        id: `${topic.id}->${prerequisite.prerequisiteTopicId}`,
        from: topic.id,
        to: prerequisite.prerequisiteTopicId,
        met: prerequisiteMap.get(prerequisite.prerequisiteTopicId)!.status === "COMPLETED",
      })),
  );

  return NextResponse.json(
    {
      group: {
        ...group,
        objectives: (group.objectivesJson as string[] | null) ?? [],
      },
      topics: topics.map((topic) => {
        const progress = "userProgress" in topic ? topic.userProgress[0] : undefined;
        return {
          id: topic.id,
          slug: topic.slug,
          title: topic.title,
          difficulty: topic.difficulty,
          estimatedMinutes: topic.estimatedMinutes,
          status: progress?.status ?? "NOT_STARTED",
          prerequisiteIds: topic.prerequisites.map((prerequisite) => prerequisite.prerequisiteTopicId),
        };
      }),
      prerequisites: Array.from(prerequisiteMap.values()),
      edges,
      // Exposed so the canvas can tell a blocked topic from a merely
      // incomplete one without recomputing the graph.
      blockedCount: edges.filter((edge) => !edge.met && visibleIds.has(edge.to)).length,
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}