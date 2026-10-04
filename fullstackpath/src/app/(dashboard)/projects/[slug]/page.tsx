import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, Layers } from "lucide-react";
import { requireUserPage } from "@/lib/permissions";
import { getProjectDetail } from "@/server/services/projects";
import { ProjectWorkspace } from "@/features/projects/components/project-workspace";
import { Badge } from "@/components/ui/badge";
import { DifficultyBadge } from "@/components/ui/feedback";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.split("-").map((w) => w[0]!.toUpperCase() + w.slice(1)).join(" ") };
}

export default async function ProjectDetailPage({ params }: Props) {
  const { slug } = await params;
  const sessionUser = await requireUserPage();

  const project = await getProjectDetail(sessionUser.id, slug);
  if (!project) notFound();

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All projects
      </Link>

      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">Milestone {project.order}</Badge>
          <DifficultyBadge difficulty={project.difficulty} />
          {project.estimatedHours && (
            <Badge variant="outline">
              <Clock className="size-3" aria-hidden />~{project.estimatedHours}h
            </Badge>
          )}
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{project.title}</h1>
        <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">
          {project.description}
        </p>
        {project.stack.length > 0 && (
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <Layers className="size-3.5" aria-hidden />
            {project.stack.join(" · ")}
          </p>
        )}
      </header>

      <ProjectWorkspace
        project={{
          ...project,
          progress: project.progress
            ? {
                status: project.progress.status,
                repositoryUrl: project.progress.repositoryUrl,
                demoUrl: project.progress.demoUrl,
                notes: project.progress.notes,
                completedAt: project.progress.completedAt,
                checklistJson: project.progress.checklistJson as Record<string, boolean> | null,
              }
            : null,
        }}
      />
    </div>
  );
}