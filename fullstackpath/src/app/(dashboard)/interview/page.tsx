import type { Metadata } from "next";
import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  Flame,
  HelpCircle,
  MessagesSquare,
  Target,
  Wrench,
  Zap,
} from "lucide-react";
import { requireUserPage } from "@/lib/permissions";
import { getReadiness } from "@/server/services/interview-kit";
import { getDrillSet } from "@/server/services/interview-kit";
import { QuestionBank } from "@/features/interview/components/question-bank";
import { MockInterviewLog } from "@/features/interview/components/mock-interview-log";
import { InterviewPrepForm } from "@/features/interview/components/interview-prep-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import {
  EmptyState,
  PageHeader,
  ProgressRing,
  StatCard,
} from "@/components/ui/feedback";
import { getMockInterviews } from "@/server/services/interview";
import { differenceInCalendarDays, format } from "date-fns";

export const metadata: Metadata = {
  title: "Interview prep",
  description:
    "Your question bank, drills, debugging scenarios and readiness — everything for the interview itself.",
};

export default async function InterviewPage() {
  const sessionUser = await requireUserPage();
  const readiness = await getReadiness(sessionUser.id);

  // A small, shuffled warm-up set. Questions the candidate could not answer last
  // time are prioritised, because that is where the marks are.
  const warmup = await getDrillSet(sessionUser.id, { count: 5, focus: "blank" }).catch(
    () => ({ items: [], total: 0, offset: 0, limit: 5 }),
  );
  const interviews = await getMockInterviews(sessionUser.id, 10);

  const { questions, practice, topics, gaps, prep } = readiness;
  const hasBank = questions.total > 0;

  const daysLeft = prep?.interviewDate
    ? differenceInCalendarDays(new Date(prep.interviewDate), new Date())
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="Interview prep"
        description="Not a course to finish. This is the question bank, the drills and the gaps that decide the round."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/interview/kit">
              <Wrench />
              Drills and scenarios
            </Link>
          </Button>
        }
      />

      {!hasBank && (
        <EmptyState
          icon={Target}
          title="The question bank is empty"
          description="Run the database seed to load the questions, model answers, drills and scenarios from the roadmap content."
          action={
            <code className="rounded bg-muted px-2 py-1 text-xs">npx prisma db seed</code>
          }
        />
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Question recall */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="size-4 text-primary" aria-hidden />
              Question recall
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <ProgressRing value={questions.confidenceRate} size={64} strokeWidth={6}>
                {questions.confidenceRate}%
              </ProgressRing>
              <div className="min-w-0 text-sm">
                <p className="font-medium">
                  {questions.confident} confident of {questions.confident + questions.partial + questions.blank}{" "}
                  attempted
                </p>
                <p className="text-xs text-muted-foreground">
                  {questions.blank} blank · {questions.partial} partial
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-green-500/10 py-2">
                <p className="text-lg font-semibold tabular-nums text-green-600 dark:text-green-400">
                  {questions.confident}
                </p>
                <p className="text-[10px] text-muted-foreground">Confident</p>
              </div>
              <div className="rounded-lg bg-cyan-500/10 py-2">
                <p className="text-lg font-semibold tabular-nums text-cyan-600 dark:text-cyan-400">
                  {questions.partial}
                </p>
                <p className="text-[10px] text-muted-foreground">Partial</p>
              </div>
              <div className="rounded-lg bg-orange-500/10 py-2">
                <p className="text-lg font-semibold tabular-nums text-orange-600 dark:text-orange-400">
                  {questions.blank}
                </p>
                <p className="text-[10px] text-muted-foreground">Blank</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              <Button asChild size="sm">
                <Link href="/interview/questions">
                  Drill the bank
                  <ChevronRight />
                </Link>
              </Button>
              {questions.blank > 0 && (
                <Button asChild size="sm" variant="outline">
                  <Link href="/interview/questions?result=BLANK">
                    Fix {questions.blank} blank
                  </Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Practice */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wrench className="size-4 text-primary" aria-hidden />
              Drills and scenarios
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-muted/60 py-2">
                <p className="text-lg font-semibold tabular-nums">{practice.total}</p>
                <p className="text-[10px] text-muted-foreground">Total blocks</p>
              </div>
              <div className="rounded-lg bg-muted/60 py-2">
                <p className="text-lg font-semibold tabular-nums">{practice.passed}</p>
                <p className="text-[10px] text-muted-foreground">Cleared</p>
              </div>
            </div>

            <ul className="space-y-1.5">
              {[
                { key: "SCENARIO", label: "Debugging scenarios", icon: Wrench },
                { key: "DRILL", label: "Drills", icon: Zap },
                { key: "RAPIDFIRE", label: "Rapid-fire sets", icon: Flame },
                { key: "MACHINE_CODING", label: "Machine coding", icon: Target },
                { key: "CHECKLIST", label: "Readiness checklists", icon: CheckCircle2 },
                { key: "QA", label: "Q&A banks", icon: MessagesSquare },
              ].map((item) => {
                const count = practice.byKind[item.key] ?? 0;
                if (count === 0) return null;
                const Icon = item.icon;
                return (
                  <li key={item.key}>
                    <Link
                      href={`/interview/kit?kind=${item.key}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-secondary"
                    >
                      <Icon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <span className="shrink-0 tabular-nums text-muted-foreground">{count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        {/* The interview being prepared for */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="size-4 text-primary" aria-hidden />
              Your interview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {prep?.interviewDate ? (
              <div className="rounded-lg border border-primary/25 bg-primary/[0.06] p-3">
                <p className="text-sm font-semibold">
                  {prep.company ?? "Interview"}{" "}
                  {prep.role ? `· ${prep.role}` : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {format(new Date(prep.interviewDate), "EEEE d MMMM yyyy")}
                </p>
                {daysLeft !== null && (
                  <p className="mt-2 text-sm">
                    {daysLeft > 0 ? (
                      <>
                        <span className="font-semibold text-primary">{daysLeft} days</span> to
                        prepare
                      </>
                    ) : daysLeft === 0 ? (
                      <span className="font-semibold text-primary">Today.</span>
                    ) : (
                      <span className="text-muted-foreground">
                        That date has passed.
                      </span>
                    )}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Set the date and company you are preparing for. Nothing here claims to make you
                ready — it only tells you what is left to cover.
              </p>
            )}
            <InterviewPrepForm
              initial={{
                company: prep?.company ?? "",
                role: prep?.role ?? "",
                level: prep?.level ?? "",
                interviewDate: prep?.interviewDate
                  ? new Date(prep.interviewDate).toISOString().slice(0, 10)
                  : "",
              }}
            />
          </CardContent>
        </Card>
      </div>

      {/* Gaps */}
      {gaps.some((gap) => gap.value > 0) && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">What is still weak</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {gaps.map((gap) => (
              <Link
                key={gap.key}
                href={gap.href}
                className="group rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40"
              >
                <p className="text-xs text-muted-foreground">{gap.label}</p>
                <p
                  className={cn(
                    "mt-1 text-2xl font-semibold tabular-nums",
                    gap.severity === "high"
                      ? "text-orange-500"
                      : gap.severity === "medium"
                        ? "text-amber-500"
                        : "text-foreground",
                  )}
                >
                  {gap.value}
                </p>
                {gap.total > 0 && (
                  <>
                    <Progress
                      value={(gap.value / gap.total) * 100}
                      className="mt-2"
                      indicatorClassName={
                        gap.severity === "high" ? "bg-orange-500" : undefined
                      }
                    />
                    <p className="mt-1 text-[11px] text-muted-foreground">of {gap.total}</p>
                  </>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Warm-up set */}
      {warmup.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Flame className="size-4 text-primary" aria-hidden />
              Warm-up: questions you got wrong last time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QuestionBank questions={warmup.items} />
          </CardContent>
        </Card>
      )}

      {/* Mock interviews */}
      <Card>
        <CardContent className="pt-5">
          <MockInterviewLog
            interviews={interviews.map((interview) => ({
              ...interview,
              performedAt: interview.performedAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>

      {/* Topic completion stays separate from question recall, on purpose. */}
      <Card>
        <CardHeader>
          <CardTitle>Roadmap topics completed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Answering a question correctly does not complete a topic. These stay separate so
            neither number lies about the other.
          </p>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Completed" value={topics.completed} tone="success" />
            <StatCard label="Practiced" value={topics.practiced} tone="info" />
            <StatCard label="In progress" value={topics.inProgress} />
            <StatCard label="Total topics" value={topics.total} tone="muted" />
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/roadmap">Open the roadmap</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...values: (string | false | null | undefined)[]) {
  return values.filter(Boolean).join(" ");
}
