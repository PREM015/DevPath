import { NextResponse } from "next/server";
import { z } from "zod";
import { getTopicPanel } from "@/server/services/roadmap";
import { getCurrentUser } from "@/lib/permissions";
import { rateLimit, clientKey, RATE_LIMITS } from "@/lib/utils/rate-limit";

const paramsSchema = z.object({ slug: z.string().min(1).max(160) });

/** Panel data for one topic, always scoped to the caller. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const limit = rateLimit(clientKey(request, "topic-panel"), RATE_LIMITS.search.limit, RATE_LIMITS.search.windowMs);
  if (!limit.success) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to track progress." }, { status: 401 });

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return NextResponse.json({ error: "Invalid topic." }, { status: 400 });

  try {
    const panel = await getTopicPanel(parsed.data.slug, user.id);
    return NextResponse.json(panel, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "That topic does not exist." }, { status: 404 });
  }
}