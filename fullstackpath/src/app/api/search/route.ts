import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/permissions";
import { rateLimit, clientKey, RATE_LIMITS } from "@/lib/utils/rate-limit";
import type { SearchHit } from "@/components/layout/global-search";

const MAX_QUERY_LENGTH = 100;
const RESULT_LIMIT = 20;

/**
 * Global search across phases, groups, topics, resources and the caller's notes.
 *
 * Roadmap entities are shared and note rows are filtered to the caller inside
 * the query, so a single response never mixes another user's private content.
 */
export async function GET(request: Request) {
  const limit = rateLimit(clientKey(request, "global-search"), RATE_LIMITS.search.limit, RATE_LIMITS.search.windowMs);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many searches. Please slow down." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, MAX_QUERY_LENGTH);

  if (query.length < 2) return NextResponse.json({ results: [] });

  const user = await getCurrentUser();
  const contains = { contains: query, mode: "insensitive" as const };

  const [phases, groups, topics, resources, notes] = await Promise.all([
    prisma.phase.findMany({
      where: { isActive: true, OR: [{ title: contains }, { description: contains }] },
      take: 4,
      orderBy: { order: "asc" },
      select: { id: true, slug: true, title: true, order: true },
    }),
    prisma.roadmapGroup.findMany({
      where: { isActive: true, OR: [{ title: contains }, { description: contains }] },
      take: 5,
      select: {
        id: true,
        slug: true,
        title: true,
        phase: { select: { title: true, order: true } },
      },
    }),
    prisma.topic.findMany({
      where: { isActive: true, OR: [{ title: contains }, { description: contains }] },
      take: 8,
      select: {
        id: true,
        slug: true,
        title: true,
        difficulty: true,
        group: { select: { title: true, phase: { select: { title: true, order: true } } } },
      },
    }),
    // Resources are stored as JSON on the topic, so they are matched in memory
    // over a narrowed slice of the roadmap rather than with a JSON query.
    prisma.topic.findMany({
      where: { isActive: true, NOT: { resourcesJson: { equals: Prisma.DbNull } } },
      select: { slug: true, title: true, resourcesJson: true },
      take: 400,
    }),
    user
      ? prisma.userNote.findMany({
          where: { userId: user.id, OR: [{ title: contains }, { content: contains }] },
          take: 5,
          orderBy: { updatedAt: "desc" },
          select: { id: true, title: true, topic: { select: { slug: true, title: true } } },
        })
      : Promise.resolve([]),
  ]);

  const results: SearchHit[] = [];

  for (const phase of phases) {
    results.push({
      id: phase.id,
      kind: "phase",
      title: phase.title,
      context: `Phase ${phase.order}`,
      href: `/roadmap?phase=${phase.slug}`,
    });
  }

  for (const group of groups) {
    results.push({
      id: group.id,
      kind: "group",
      title: group.title,
      context: `${group.phase.title} · group`,
      href: `/roadmap?group=${group.slug}`,
    });
  }

  for (const topic of topics) {
    results.push({
      id: topic.id,
      kind: "topic",
      title: topic.title,
      context: `${topic.group.phase.title} › ${topic.group.title}`,
      href: `/roadmap/${topic.slug}`,
      difficulty: topic.difficulty,
    });
  }

  const needle = query.toLowerCase();
  for (const topic of resources) {
    const list = (topic.resourcesJson as { title?: string; url?: string }[] | null) ?? [];
    for (const resource of list) {
      if (!resource.title || !resource.title.toLowerCase().includes(needle)) continue;
      results.push({
        id: `${topic.slug}-${resource.url}`,
        kind: "resource",
        title: resource.title,
        context: `Resource for ${topic.title}`,
        href: `/roadmap/${topic.slug}`,
      });
      break;
    }
    if (results.length >= RESULT_LIMIT) break;
  }

  for (const note of notes) {
    results.push({
      id: note.id,
      kind: "note",
      title: note.title,
      context: note.topic ? `Note on ${note.topic.title}` : "Personal note",
      href: `/notes?note=${note.id}`,
    });
  }

  return NextResponse.json(
    { results: results.slice(0, RESULT_LIMIT) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}