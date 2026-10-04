import type { Metadata } from "next";
import Link from "next/link";
import { requireUserPage } from "@/lib/permissions";
import { prisma } from "@/lib/db/prisma";
import { listQuestions, getQuestionStats } from "@/server/services/interview-kit";
import { QuestionBank } from "@/features/interview/components/question-bank";
import { Card, CardContent } from "@/components/ui/card";
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" method="get">
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search questions…"
              aria-label="Search questions"
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />

            <select
              name="phase"
              defaultValue={params.phase ?? ""}
              aria-label="Filter by phase"
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All phases</option>
              {phases.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.order}. {phase.title}
                </option>
              ))}
            </select>

            <select
              name="result"
              defaultValue={params.result ?? ""}
              aria-label="Filter by how you answered"
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Any result</option>
              <option value="unattempted">Never attempted</option>
              <option value="BLANK">Went blank</option>
              <option value="PARTIAL">Partial</option>
              <option value="CONFIDENT">Confident</option>
            </select>

            <select
              name="difficulty"
              defaultValue={params.difficulty ?? ""}
              aria-label="Filter by difficulty"
              className="h-9 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Any difficulty</option>
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
              <option value="SENIOR">Senior</option>
            </select>

            <div className="flex gap-2 sm:col-span-2 lg:col-span-4">
              <Button type="submit" size="sm">
                Apply
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href="/interview/questions">Reset</Link>
              </Button>
              <span className="ml-auto self-center text-xs text-muted-foreground">
                {result.total.toLocaleString()} match{result.total === 1 ? "" : "es"}
              </span>
            </div>
          </form>

          {/* Quick jumps to the gaps that matter */}
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-border pt-3">
            <Button asChild size="xs" variant="outline">
              <Link href={buildHref({ result: "BLANK" })}>
                Went blank ({stats.blank})
              </Link>
            </Button>
            <Button asChild size="xs" variant="outline">
              <Link href={buildHref({ result: "unattempted" })}>
                Never attempted ({stats.unattempted})
              </Link>
            </Button>
            <Button asChild size="xs" variant="outline">
              <Link href={buildHref({ result: "PARTIAL" })}>
                Partial ({stats.partial})
              </Link>
            </Button>
            <Button asChild size="xs" variant="outline">
              <Link href={buildHref({ result: "CONFIDENT" })}>
                Confident ({stats.confident})
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

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
