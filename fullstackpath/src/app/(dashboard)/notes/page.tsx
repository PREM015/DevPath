import type { Metadata } from "next";
import { prisma } from "@/lib/db/prisma";
import { requireUserPage } from "@/lib/permissions";
import { listNotes, getNoteStats } from "@/server/services/notes";
import { NotesWorkspace } from "@/features/notes/components/notes-workspace";
import { PageHeader } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Notes",
  description: "Your private Markdown notes, linked to roadmap topics.",
};

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ note?: string; q?: string }>;
}) {
  const sessionUser = await requireUserPage();
  const { note, q } = await searchParams;

  const [result, stats, topics] = await Promise.all([
    listNotes(sessionUser.id, { query: q, limit: 50 }),
    getNoteStats(sessionUser.id),
    // Only the topics needed to populate the link dropdown, kept small.
    prisma.topic.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
      take: 400,
      select: { id: true, slug: true, title: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <PageHeader
        title="Notes"
        description={`${stats.total} note${stats.total === 1 ? "" : "s"} · ${stats.wordCount.toLocaleString()} words · ${stats.pinned} pinned. Notes are visible only to you.`}
      />

      <NotesWorkspace
        initialNotes={result.items.map((item) => ({
          id: item.id,
          title: item.title,
          content: item.content,
          tags: item.tags,
          isPinned: item.isPinned,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
          topic: item.topic
            ? { id: item.topic.id, slug: item.topic.slug, title: item.topic.title }
            : null,
        }))}
        initialSelectedId={note ?? result.items[0]?.id ?? null}
        topics={topics}
        stats={stats}
      />
    </div>
  );
}