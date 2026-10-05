import type { Metadata } from "next";
import Link from "next/link";
import { requireUserPage } from "@/lib/permissions";
import { prisma } from "@/lib/db/prisma";
import { listQuestions, getQuestionStats } from "@/server/services/interview-kit";
import { QuestionBank } from "@/features/interview/components/question-bank";
import { QuestionFilters } from "@/features/interview/components/question-filters";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/ui/feedback";
import { HelpCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "Question bank",
  description:
    "Every interview question in the roadmap, with model answers and honest self-rating.",
};

type Search = {
  q?: string;
  phase?: string;
  result?: string;
  difficulty?: string;
  page?: string;
};

export default async function QuestionsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sessionUser = await requireUserPage();
  const params = await searchParams;

  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const pageSize = 25;

  const [result, stats, phases] = await Promise.all([
    listQuestions(sessionUser.id, {
      query: params.q,
      phaseId: params.phase,
      result: params.result,
      difficulty: params.difficulty,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    getQuestionStats(sessionUser.id),
    prisma.phase.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: { id: true, slug: true, title: true, order: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(result.total / pageSize));

  // Pagination links only need to carry the page number; the filter bar owns
  // the filters and already resets to page 1 whenever one changes.
  const buildHref = (overrides: Partial<Search>) => {
    const next = { ...params, ...overrides };
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, String(value));
    }
    const search = query.toString();
    return search ? `/interview/questions?${search}` : "/interview/questions";
  };

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Question bank"
        description={`${stats.total.toLocaleString()} questions · ${stats.withModelAnswer.toLocaleString()} with a model answer. Answer out loud before you reveal.`}
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/interview">Back to prep</Link>
          </Button>
        }
      />

      <QuestionFilters
        phases={phases.map((phase) => ({ id: phase.id, order: phase.order, title: phase.title }))}
        total={result.total}
        totalAll={stats.total}
        stats={stats}
      />

      {result.items.length === 0 ? (
        <EmptyState
          icon={HelpCircle}
          title="No questions match"
          description="Try clearing the filters, or run the database seed if the bank is empty."
          action={
            <Button asChild size="sm">
              <Link href="/interview/questions">Clear filters</Link>
            </Button>
          }
        />
      ) : (
        <>
          <QuestionBank questions={result.items} />

          {totalPages > 1 && (
            <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
              {page > 1 ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={buildHref({ page: String(page - 1) })}>Previous</Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  Previous
                </Button>
              )}
              <span className="text-xs text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page < totalPages ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={buildHref({ page: String(page + 1) })}>Next</Link>
                </Button>
              ) : (
                <Button size="sm" variant="outline" disabled>
                  Next
                </Button>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}
