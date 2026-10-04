import type { Metadata } from "next";
import { FolderGit2, ExternalLink } from "lucide-react";
import { requireUserPage } from "@/lib/permissions";
import { getProjects, getProjectStats } from "@/server/services/projects";
import { ProjectCard } from "@/features/projects/components/project-workspace";
import { EmptyState, PageHeader, StatCard, ProgressRing } from "@/components/ui/feedback";

export const metadata: Metadata = {
  title: "Projects",
  description: "Eight project milestones with per-user checklists, links and notes.",
};

export default async function ProjectsPage() {
  const sessionUser = await requireUserPage();

  const [projects, stats] = await Promise.all([
    getProjects(sessionUser.id),
    getProjectStats(sessionUser.id),
  ]);

  const completionPercentage =
    stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Project milestones"
        description="Eight projects that turn the roadmap into shipped work. Progress is tracked independently for each account."
      />

      {stats.total === 0 ? (
        <EmptyState
          icon={FolderGit2}
          title="Projects have not been seeded"
          description="Run the database seed to load the eight project milestones."
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <CardWrap>
              <div className="flex items-center gap-4 p-4">
                <ProgressRing value={completionPercentage} size={60} strokeWidth={6} />
                <div>
                  <p className="text-xs text-muted-foreground">Milestones completed</p>
                  <p className="text-sm font-medium">
                    {stats.completed} of {stats.total}
                  </p>
                </div>
              </div>
            </CardWrap>
            <StatCard label="In progress" value={stats.inProgress} tone="info" />
            <StatCard label="Abandoned" value={stats.abandoned} tone="muted" />
            <StatCard
              label="Remaining"
              value={Math.max(0, stats.total - stats.completed - stats.abandoned)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>

          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <ExternalLink className="size-3.5" aria-hidden />
            A project is never counted as completed automatically — mark it yourself when it is
            genuinely shipped.
          </p>
        </>
      )}
    </div>
  );
}

function CardWrap({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-border bg-card">{children}</div>;
}