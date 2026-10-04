import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { getProgressForTopics } from "@/server/services/progress";
import { getArchivedTopics } from "@/server/services/roadmap";
import { rateLimit, clientKey, RATE_LIMITS } from "@/lib/utils/rate-limit";

/**
 * Topic search used by the roadmap filters and the /learning topic picker.
 *
 * Pagination is enforced here rather than trusting a `limit` from the client, and
 * archived topics are excluded unless explicitly requested so historical content
 * does not inflate the visible roadmap.
 */
export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, "search"), RATE_LIMITS.search.limit, RATE_LIMITS.search.windowMs);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to search topics." }, { status: 401 });
  }

  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  const status = url.searchParams.get("status") ?? "";
  const phaseId = url.searchParams.get("phaseId") ?? "";
  const difficulty = url.searchParams.get("difficulty") ?? "";
  const groupId = url.searchParams.get("groupId") ?? "";
  const includeArchived = url.searchParams.get("includeArchived") === "true";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 24) || 24));

  if (includeArchived) {
    const archived = await getArchivedTopics(user.id);
    return NextResponse.json({
      items: archived,
      total: archived.length,
      page: 1,
      pageSize: archived.length,
      archivedOnly: true,
    });
  }

  const where: Prisma.TopicWhereInput = {
    isActive: true,
    ...(query
      ? {
          OR: [
            { title: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(groupId ? { groupId } : {}),
    ...(phaseId ? { group: { phaseId } } : {}),
    ...(difficulty ? { difficulty: difficulty as Prisma.EnumDifficultyFilter["equals"] } : {}),
    ...(status ? { userProgress: { some: { userId: user.id, status: status as never } } } : {}),
  };

  const [topics, total] = await Promise.all([
    prisma.topic.findMany({
      where,
      orderBy: [
        { group: { phase: { order: "asc" } } },
        { group: { order: "asc" } },
        { order: "asc" },
      ],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        difficulty: true,
        estimatedMinutes: true,
        group: {
          select: { id: true, title: true, phase: { select: { id: true, title: true, order: true } } },
        },
        userProgress: {
          where: { userId: user.id },
          select: { status: true, completedAt: true, lastStudiedAt: true },
          take: 1,
        },
        bookmarks: { where: { userId: user.id }, select: { id: true }, take: 1 },
      },
    }),
    prisma.topic.count({ where }),
  ]);

  return NextResponse.json(
    {
      items: topics.map((topic) => ({
        id: topic.id,
        slug: topic.slug,
        title: topic.title,
        description: topic.description,
        difficulty: topic.difficulty,
        estimatedMinutes: topic.estimatedMinutes,
        groupId: topic.group.id,
        groupTitle: topic.group.title,
        phaseId: topic.group.phase.id,
        phaseTitle: topic.group.phase.title,
        phaseOrder: topic.group.phase.order,
        status: topic.userProgress[0]?.status ?? "NOT_STARTED",
        completedAt: topic.userProgress[0]?.completedAt ?? null,
        lastStudiedAt: topic.userProgress[0]?.lastStudiedAt ?? null,
        bookmarked: topic.bookmarks.length > 0,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}

/** Progress for a specific set of topic ids — used to refresh the canvas. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const ids = (body as { topicIds?: unknown })?.topicIds;
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ items: [] });
  }
  if (ids.length > 500) {
    return NextResponse.json({ error: "Too many topic ids in one request." }, { status: 413 });
  }

  const topicIds = ids.filter((id): id is string => typeof id === "string");
  const snapshot = await getProgressForTopics(user.id, topicIds);

  return NextResponse.json(
    {
      items: topicIds.map((topicId) => ({
        topicId,
        status: snapshot.statusByTopic.get(topicId) ?? "NOT_STARTED",
      })),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}