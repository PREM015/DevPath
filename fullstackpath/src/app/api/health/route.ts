import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Health check.
 *
 * Reports connectivity to the database and, when seeded, how much roadmap
 * content is present. Returns 503 when the database is unreachable so a
 * platform-level health probe can actually detect an outage rather than seeing a
 * 200 from a broken app.
 */
export async function GET() {
  const startedAt = Date.now();

  try {
    const [phases, groups, topics, users] = await Promise.all([
      prisma.phase.count({ where: { isActive: true } }),
      prisma.roadmapGroup.count({ where: { isActive: true } }),
      prisma.topic.count({ where: { isActive: true } }),
      prisma.user.count(),
    ]);

    const seeded = phases > 0;

    return NextResponse.json(
      {
        status: seeded ? "ok" : "degraded",
        database: "reachable",
        latencyMs: Date.now() - startedAt,
        seeded,
        content: { phases, groups, topics },
        users,
        timestamp: new Date().toISOString(),
      },
      {
        status: seeded ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        database: "unreachable",
        error: error instanceof Error ? error.message : "Unknown database error",
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}