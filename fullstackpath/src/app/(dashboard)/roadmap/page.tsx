import type { Metadata } from "next";
import { RoadmapCanvas } from "@/components/roadmap/roadmap-canvas";
import { getCurrentUser } from "@/lib/permissions";
import { getPhaseSummaries, getPhaseProgressSummary } from "@/server/services/roadmap";
import type { PhaseNodeData } from "@/components/roadmap/types";

export const metadata: Metadata = {
  title: "Interactive roadmap",
  description:
    "Explore the full stack interview roadmap as an interactive graph. Expand a phase, then a group, to reach individual topics and update your progress without leaving the canvas.",
};

export default async function RoadmapPage() {
  const user = await getCurrentUser();
  const phases = await getPhaseSummaries();

  // Completion counts come from the caller's own progress only.
  const withProgress = user
    ? await getPhaseProgressSummary(user.id, phases.map((phase) => phase.id))
    : new Map<string, { completed: number; total: number }>();

  const nodes: PhaseNodeData[] = phases.map((phase) => {
    const progress = withProgress.get(phase.id);
    const completed = progress?.completed ?? 0;
    return {
      id: phase.id,
      slug: phase.slug,
      title: phase.title,
      order: phase.order,
      color: phase.color,
      icon: phase.icon,
      difficulty: phase.difficulty,
      estimatedHours: phase.estimatedHours,
      topicCount: phase.topicCount,
      groupCount: phase.groupCount,
      completedCount: completed,
      percentage: phase.topicCount > 0 ? Math.round((completed / phase.topicCount) * 100) : 0,
      expanded: false,
      loading: false,
    };
  });

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="shrink-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Interactive roadmap</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Click a phase to reveal its groups, then a group to reveal its topics. Click any topic to
          read its detail panel and update your progress without leaving the canvas. Use the list
          view on small screens, or switch to it for a denser reading experience.
        </p>
      </div>

      <div className="min-h-0 flex-1">
        <RoadmapCanvas initialPhases={nodes} />
      </div>
    </div>
  );
}