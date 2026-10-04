import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  AlertTriangle,
  Lightbulb,
  ListChecks,
  MessagesSquare,
  Clock,
  Link2,
  Wrench,
  Target,
  Volume2,
  Ban,
  Scale,
  Info,
  X,
} from "lucide-react";
import { requireUserPage } from "@/lib/permissions";
import { getTopicDetail } from "@/server/services/roadmap";
import { ProgressControls } from "@/features/progress/components/progress-controls";
import { TopicQuestions } from "@/features/interview/components/topic-questions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "@/components/ui/feedback";
import { cn, formatDate, formatDuration } from "@/lib/utils";

type Props = { params: Promise<{ topicSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topicSlug } = await params;
  return {
    title: topicSlug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" "),
  };
}

/**
 * Topic page.
 *
 * Ordered for someone preparing for an interview, not someone browsing a
 * tutorial: the questions come first, then how to answer them, then the
 * supporting material (concepts, drills, resources) that fills the gaps.
 */
export default async function TopicPage({ params }: Props) {
  const { topicSlug } = await params;
  const sessionUser = await requireUserPage();

  let topic;
  try {
    topic = await getTopicDetail(topicSlug, sessionUser.id);
  } catch {
    notFound();
  }

  const { interview, troubleshooting } = topic;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <Link
        href="/roadmap"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to roadmap
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">
            Phase {topic.group.phase.order} · {topic.group.phase.title}
          </Badge>
          <Badge variant="outline">{topic.group.title}</Badge>
          <DifficultyBadge difficulty={topic.difficulty} />
          {topic.isArchived && <Badge variant="warning">Archived</Badge>}
        </div>

        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{topic.title}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {topic.description}
        </p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            About {formatDuration(topic.estimatedMinutes)} of study
          </span>
          {topic.progress?.totalTimeMinutes ? (
            <span className="flex items-center gap-1 text-primary">
              <Clock className="size-3.5" aria-hidden />
              {formatDuration(topic.progress.totalTimeMinutes)} logged
            </span>
          ) : null}
          {topic.progress?.completedAt ? (
            <span className="text-green-600 dark:text-green-400">
              Completed {formatDate(topic.progress.completedAt)}
            </span>
          ) : null}
        </div>
      </header>

      {topic.isArchived && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-500/25 bg-orange-500/10 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-orange-600 dark:text-orange-400" aria-hidden />
          <p className="text-sm text-orange-700 dark:text-orange-300">
            Archived: this topic is no longer part of the recommended roadmap. Your progress and
            notes are preserved.
          </p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {/* ── 1. Why they ask it ────────────────────────────── */}
          {interview.whyAsked && (
            <Card className="border-primary/25">
              <CardContent className="p-5">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Target className="size-4 text-primary" aria-hidden />
                  Why they ask this
                </h2>
                <p className="text-sm leading-relaxed text-foreground">{interview.whyAsked}</p>
              </CardContent>
            </Card>
          )}

          {/* ── 2. The questions ───────────────────────────────── */}
          {topic.interviewQuestions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessagesSquare className="size-4 text-primary" aria-hidden />
                  Questions you will be asked
                  <span className="text-xs font-normal text-muted-foreground">
                    {interview.answeredCount} of {interview.questionCount} have a model answer
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-xs text-muted-foreground">
                  Answer out loud before revealing. Reading the answer teaches recognition, not
                  recall — and recall is what the interview tests.
                </p>
                <TopicQuestions questions={topic.interviewQuestions} />
              </CardContent>
            </Card>
          )}

          {/* ── 3. How to say it ───────────────────────────────── */}
          {interview.sayOutLoud && (
            <Card className="border-primary/25">
              <CardContent className="p-5">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Volume2 className="size-4 text-primary" aria-hidden />
                  Say out loud
                </h2>
                <p className="text-sm leading-relaxed text-foreground">{interview.sayOutLoud}</p>
              </CardContent>
            </Card>
          )}

          {/* ── 4. The rubric ─────────────────────────────────── */}
          {interview.evaluation.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="size-4 text-primary" aria-hidden />
                  What they evaluate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {interview.evaluation.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
                {interview.signal && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">A strong answer signals: </span>
                    {interview.signal}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── 5. Follow-ups and traps ────────────────────────── */}
          {(interview.probe.length > 0 || interview.wrongAnswers.length > 0) && (
            <div className="grid gap-5 sm:grid-cols-2">
              {interview.probe.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wrench className="size-4 text-orange-500" aria-hidden />
                      They will probe
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {interview.probe.map((item) => (
                        <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                          <span className="mt-1.5 size-1 shrink-0 rounded-full bg-orange-500/60" aria-hidden />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {interview.wrongAnswers.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Ban className="size-4 text-destructive" aria-hidden />
                      Answers that disqualify you
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-1.5">
                      {interview.wrongAnswers.map((item) => (
                        <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                          <X className="mt-0.5 size-3.5 shrink-0 text-destructive/70" aria-hidden />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ── 6. Trade-offs ─────────────────────────────────── */}
          {interview.tradeoffs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scale className="size-4 text-primary" aria-hidden />
                  The trade-off they want you to name
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {interview.tradeoffs.map((item) => (
                    <li key={item} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* ── 7. Debugging runbook ───────────────────────────── */}
          {troubleshooting && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Wrench className="size-4 text-primary" aria-hidden />
                  Diagnosing it
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {troubleshooting.symptoms.length > 0 && (
                  <Runbook title="What you see" items={troubleshooting.symptoms} />
                )}
                {troubleshooting.investigation.length > 0 && (
                  <Runbook title="How to investigate" items={troubleshooting.investigation} />
                )}
                {troubleshooting.rootCause.length > 0 && (
                  <Runbook title="Root cause" items={troubleshooting.rootCause} tone="destructive" />
                )}
                {troubleshooting.fix.length > 0 && (
                  <Runbook title="Fix" items={troubleshooting.fix} tone="success" />
                )}
                {troubleshooting.prevention.length > 0 && (
                  <Runbook title="Prevention" items={troubleshooting.prevention} />
                )}
                {troubleshooting.tools.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 text-xs font-medium text-muted-foreground">Tools</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {troubleshooting.tools.map((tool) => (
                        <Badge key={tool} variant="outline">
                          {tool}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* ── 8. Concepts ───────────────────────────────────── */}
          {topic.keyConcepts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Concepts you must be able to state</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {topic.keyConcepts.map((concept) => (
                    <li
                      key={concept}
                      className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
                    >
                      {concept}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* ── 9. Practice ───────────────────────────────────── */}
          {topic.practiceTasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="size-4 text-primary" aria-hidden />
                  Do this to actually know it
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2">
                  {topic.practiceTasks.map((task, index) => (
                    <li key={task} className="flex gap-3 text-sm text-muted-foreground">
                      <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                        {index + 1}
                      </span>
                      {task}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {topic.objectives.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="size-4 text-primary" aria-hidden />
                  Learning objectives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {topic.objectives.map((objective) => (
                    <li key={objective} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
                      {objective}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {topic.commonMistakes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-orange-500" aria-hidden />
                  Common mistakes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {topic.commonMistakes.map((mistake) => (
                    <li key={mistake} className="flex gap-2 text-sm text-muted-foreground">
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-orange-500/60" aria-hidden />
                      {mistake}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* ── 10. Reference material ────────────────────────── */}
          {topic.resources.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="size-4 text-primary" aria-hidden />
                  Reference material
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {topic.resources.map((resource) => (
                    <li key={resource.url}>
                      <a
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="group flex items-start gap-3 rounded-lg border border-border px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-secondary/40"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{resource.title}</p>
                          {resource.note && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{resource.note}</p>
                          )}
                        </div>
                        {resource.type && (
                          <Badge variant="outline" className="mt-0.5 shrink-0">
                            {resource.type}
                          </Badge>
                        )}
                        <ExternalLink
                          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                          aria-hidden
                        />
                      </a>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {topic.referenceMarkdown && (
            <details className="rounded-xl border border-border bg-card">
              <summary className="cursor-pointer px-5 py-3 text-sm font-semibold">
                Code and diagrams from the source
              </summary>
              <div className="border-t border-border px-5 py-4">
                <div className="md-preview max-h-96 overflow-y-auto text-sm">
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs">
                    {topic.referenceMarkdown.replace(/```[a-z]*\n?/g, "")}
                  </pre>
                </div>
              </div>
            </details>
          )}

          {topic.related.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Related topics</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="grid gap-2 sm:grid-cols-2">
                  {topic.related.map((related) => (
                    <li key={related.id}>
                      <Link
                        href={`/roadmap/${related.slug}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:border-primary/40 hover:bg-secondary/40"
                      >
                        <span className="truncate">{related.title}</span>
                        <Badge variant="outline" className="shrink-0">
                          {related.relationType.toLowerCase()}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Sidebar ──────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader>
              <CardTitle>Your progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ProgressControls
                topicId={topic.id}
                slug={topic.slug}
                initialStatus={(topic.progress?.status ?? "NOT_STARTED") as never}
                initialCompletedAt={
                  topic.progress?.completedAt ? topic.progress.completedAt.toISOString() : null
                }
                initialBookmarked={topic.bookmarked}
                initialScheduled={Boolean(topic.revision)}
                initialMinutes={topic.progress?.totalTimeMinutes ?? 0}
                blocked={Boolean(topic.blockedReason)}
              />
            </CardContent>
          </Card>

          {topic.blockedReason && (
            <div className="rounded-lg border border-border bg-muted/50 p-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {topic.blockedReason}
              </p>
            </div>
          )}

          {interview.prerequisites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Prerequisites</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {topic.prerequisites.map((item) => (
                    <li key={item.id}>
                      <Link
                        href={`/roadmap/${item.slug}`}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-secondary"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "size-2 shrink-0 rounded-full",
                            item.status === "COMPLETED" ? "bg-green-500" : "bg-border",
                          )}
                        />
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {topic.notes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Your notes</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5">
                  {topic.notes.map((note) => (
                    <li key={note.id}>
                      <Link
                        href={`/notes?note=${note.id}`}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-secondary"
                      >
                        <span className="truncate">{note.title}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {formatDate(note.updatedAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {topic.recentSessions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Study history</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1.5 text-xs text-muted-foreground">
                  {topic.recentSessions.map((session) => (
                    <li key={session.id} className="flex justify-between gap-2">
                      <span>{formatDate(session.startedAt)}</span>
                      <span>{formatDuration(session.durationMinutes)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}

function Runbook({
  title,
  items,
  tone = "default",
}: {
  title: string;
  items: string[];
  tone?: "default" | "destructive" | "success";
}) {
  const toneClass =
    tone === "destructive"
      ? "border-red-500/25 bg-red-500/[0.07]"
      : tone === "success"
        ? "border-green-500/25 bg-green-500/[0.07]"
        : "border-border bg-muted/30";

  return (
    <div className={cn("rounded-lg border p-3", toneClass)}>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((item, index) => (
          <li key={`${item}-${index}`} className="flex gap-2 text-sm text-foreground">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-current opacity-40" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
