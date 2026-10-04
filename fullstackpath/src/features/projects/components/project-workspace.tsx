"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FolderGit2, Check, LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress, Checkbox } from "@/components/ui/primitives";
import { DifficultyBadge } from "@/components/ui/feedback";
import { cn } from "@/lib/utils";
import {
  toggleProjectChecklistAction,
  updateProjectAction,
} from "@/server/actions/projects";

export type ProjectDetail = {
  id: string;
  slug: string;
  title: string;
  description: string;
  order: number;
  difficulty: string;
  estimatedHours: number | null;
  stack: string[];
  objectives: string[];
  checklist: string[];
  relatedTopics: {
    slug: string;
    title: string;
    difficulty: string;
    group: { phase: { title: string; order: number } };
  }[];
  progress: {
    status: string;
    repositoryUrl: string | null;
    demoUrl: string | null;
    notes: string | null;
    completedAt: Date | string | null;
    checklistJson: Record<string, boolean> | null;
  } | null;
};

const STATUS_OPTIONS = [
  { value: "NOT_STARTED", label: "Not started" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "ABANDONED", label: "Abandoned" },
] as const;

export function ProjectWorkspace({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const [status, setStatus] = React.useState(project.progress?.status ?? "NOT_STARTED");
  const [repositoryUrl, setRepositoryUrl] = React.useState(project.progress?.repositoryUrl ?? "");
  const [demoUrl, setDemoUrl] = React.useState(project.progress?.demoUrl ?? "");
  const [notes, setNotes] = React.useState(project.progress?.notes ?? "");
  const [checklist, setChecklist] = React.useState<Record<string, boolean>>(
    (project.progress?.checklistJson as Record<string, boolean> | null) ?? {},
  );
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = React.useState<string | null>(null);

  async function save(patch: Partial<{ status: string; repositoryUrl: string; demoUrl: string; notes: string }>) {
    setPending("save");
    setMessage(null);
    try {
      const result = await updateProjectAction({
        projectId: project.id,
        status: patch.status as never,
        repositoryUrl: patch.repositoryUrl,
        demoUrl: patch.demoUrl,
        notes: patch.notes,
      });
      setMessage(
        result.ok
          ? { kind: "ok", text: result.message }
          : { kind: "error", text: result.error },
      );
      if (result.ok) router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function toggleChecklist(index: number) {
    const next = !checklist[String(index)];
    setChecklist((current) => ({ ...current, [String(index)]: next }));

    const result = await toggleProjectChecklistAction({
      projectId: project.id,
      index,
      done: next,
    });
    if (!result.ok) {
      setChecklist((current) => ({ ...current, [String(index)]: !next }));
      setMessage({ kind: "error", text: result.error });
      return;
    }
    router.refresh();
  }

  const done = project.checklist.filter((_, index) => checklist[String(index)]).length;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <CardSection title="Build checklist">
          {project.checklist.length === 0 ? (
            <p className="text-sm text-muted-foreground">No checklist configured.</p>
          ) : (
            <>
              <div className="mb-3 space-y-1.5">
                <Progress value={(done / project.checklist.length) * 100} />
                <p className="text-xs text-muted-foreground">
                  {done} of {project.checklist.length} complete
                </p>
              </div>
              <ul className="space-y-2">
                {project.checklist.map((item, index) => (
                  <li key={item}>
                    <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-secondary/40">
                      <Checkbox
                        checked={Boolean(checklist[String(index)])}
                        onCheckedChange={() => toggleChecklist(index)}
                        aria-label={item}
                        className="mt-0.5"
                      />
                      <span
                        className={cn(
                          checklist[String(index)] && "text-muted-foreground line-through",
                        )}
                      >
                        {item}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardSection>

        {project.objectives.length > 0 && (
          <CardSection title="What this project proves">
            <ul className="space-y-2">
              {project.objectives.map((objective) => (
                <li key={objective} className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" aria-hidden />
                  {objective}
                </li>
              ))}
            </ul>
          </CardSection>
        )}

        <CardSection title="Your notes">
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What you built, what broke, what you would do differently…"
            aria-label="Project notes"
            className="min-h-[140px]"
          />
          <Button
            size="sm"
            className="mt-2"
            loading={pending === "save"}
            onClick={() => save({ notes })}
          >
            Save notes
          </Button>
        </CardSection>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <CardSection title="Your status">
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              void save({ status: event.target.value });
            }}
            aria-label="Project status"
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="mt-3 space-y-2">
            <Input
              value={repositoryUrl}
              onChange={(event) => setRepositoryUrl(event.target.value)}
              placeholder="https://github.com/you/project"
              aria-label="Repository URL"
              inputMode="url"
            />
            <Input
              value={demoUrl}
              onChange={(event) => setDemoUrl(event.target.value)}
              placeholder="https://your-demo.example.com"
              aria-label="Live demo URL"
              inputMode="url"
            />
            <Button
              size="sm"
              variant="outline"
              loading={pending === "save"}
              onClick={() => save({ repositoryUrl, demoUrl })}
              className="w-full"
            >
              <LinkIcon />
              Save links
            </Button>
          </div>

          {message && (
            <p
              role="status"
              className={cn(
                "mt-2 text-xs",
                message.kind === "ok" ? "text-green-600 dark:text-green-400" : "text-destructive",
              )}
            >
              {message.text}
            </p>
          )}
        </CardSection>

        {project.stack.length > 0 && (
          <CardSection title="Tech stack">
            <div className="flex flex-wrap gap-1.5">
              {project.stack.map((item) => (
                <Badge key={item} variant="outline">
                  {item}
                </Badge>
              ))}
            </div>
          </CardSection>
        )}

        {project.relatedTopics.length > 0 && (
          <CardSection title="Roadmap topics this uses">
            <ul className="space-y-1">
              {project.relatedTopics.map((topic) => (
                <li key={topic.slug}>
                  <Link
                    href={`/roadmap/${topic.slug}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-secondary"
                  >
                    <span className="min-w-0 truncate">{topic.title}</span>
                    <DifficultyBadge difficulty={topic.difficulty} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardSection>
        )}
      </aside>
    </div>
  );
}

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function ProjectCard({
  project,
}: {
  project: {
    slug: string;
    title: string;
    description: string;
    difficulty: string;
    estimatedHours: number | null;
    stack: string[];
    progress: { status: string; checklistDone: number; checklistTotal: number };
  };
}) {
  const percentage =
    project.progress.checklistTotal > 0
      ? Math.round((project.progress.checklistDone / project.progress.checklistTotal) * 100)
      : 0;

  return (
    <Link
      href={`/projects/${project.slug}`}
      className="group block rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-card"
    >
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FolderGit2 className="size-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold">{project.title}</p>
            {project.progress.status === "COMPLETED" && (
              <Check className="size-3.5 text-green-500" aria-label="Completed" />
            )}
          </div>
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {project.description}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <DifficultyBadge difficulty={project.difficulty} />
        {project.estimatedHours && (
          <Badge variant="outline">~{project.estimatedHours}h</Badge>
        )}
        <Badge
          variant={
            project.progress.status === "COMPLETED"
              ? "success"
              : project.progress.status === "IN_PROGRESS"
                ? "info"
                : "outline"
          }
        >
          {project.progress.status.replace(/_/g, " ").toLowerCase()}
        </Badge>
      </div>

      {project.progress.checklistTotal > 0 && (
        <div className="mt-3 space-y-1">
          <Progress value={percentage} />
          <p className="text-[11px] text-muted-foreground">
            {project.progress.checklistDone}/{project.progress.checklistTotal} checklist items
          </p>
        </div>
      )}
    </Link>
  );
}