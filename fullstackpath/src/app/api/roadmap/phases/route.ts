import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { rateLimit, clientKey, RATE_LIMITS } from "@/lib/utils/rate-limit";

/**
 * Phase completion counts for the roadmap canvas.
 *
 * Public on purpose: it aggregates roadmap content and each caller's own
 * progress, so there is nothing shared-and-sensitive in the response and nothing
 * is cached across users. Anonymous callers get totals only.
 */
export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, "roadmap-phases"), RATE_LIMITS.search.limit, RATE_LIMITS.search.windowMs);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const user = await getCurrentUser();
  const userId = user?.id;

  const phases = await prisma.phase.findMany({
    where: { isActive: true },
    orderBy: { order: "asc" },
    select: {
      id: true,
      slug: true,
      title: true,
      order: true,
      color: true,
      icon: true,
      difficulty: true,
      estimatedHours: true,
      groups: {
        where: { isActive: true },
        select: {
          id: true,
          _count: { select: { topics: { where: { isActive: true } } } },
          topics: {
            where: { isActive: true },
            select: {
              id: true,
              ...(userId
                ? {
                    userProgress: {
                      where: { userId },
                      select: { status: true },
                      take: 1,
                    },
                  }
                : {}),
            },
          },
        },
      },
    },
  });

  return NextResponse.json(
    phases.map((phase) => {
      const topics = phase.groups.flatMap((group) => group.topics);
      const completed = topics.filter(
        (topic) =>
          "userProgress" in topic && topic.userProgress[0]?.status === "COMPLETED",
      ).length;

      return {
        id: phase.id,
        slug: phase.slug,
        title: phase.title,
        order: phase.order,
        color: phase.color,
        icon: phase.icon,
        difficulty: phase.difficulty,
        estimatedHours: phase.estimatedHours,
        groupCount: phase.groups.length,
        topicCount: topics.length,
        completedCount: completed,
        percentage: topics.length > 0 ? Math.round((completed / topics.length) * 100) : 0,
      };
    }),
    {
      headers: {
        // Private: the payload embeds the caller's progress.
        "Cache-Control": "private, no-store",
      },
    },
  );
}