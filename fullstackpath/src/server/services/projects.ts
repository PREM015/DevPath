import "server-only";

import { prisma } from "@/lib/db/prisma";

/**
 * Project milestones and the caller's independent progress on each.
 *
 * The eight projects are shared content; only `UserProjectProgress` is per user,
 * so one user's project state never touches another's.
 */
export async function getProjects(userId: string) {
  const [projects, progress] = await Promise.all([
    prisma.project.findMany({ orderBy: { order: "asc" } }),
    prisma.userProjectProgress.findMany({
      where: { userId },
      select: {
        status: true,
        repositoryUrl: true,
        demoUrl: true,
        notes: true,
        checklistJson: true,
        completedAt: true,
        updatedAt: true,
        projectId: true,
      },
    }),
  ]);

  const byProject = new Map(progress.map((row) => [row.projectId, row]));

  return projects.map((project) => {
    const userProgress = byProject.get(project.id);
    const checklist = (project.checklistJson as string[] | null) ?? [];
    const done = (userProgress?.checklistJson as Record<string, boolean> | null) ?? {};

    return {
      id: project.id,
      slug: project.slug,
      title: project.title,
      description: project.description,
      order: project.order,
      difficulty: project.difficulty,
      estimatedHours: project.estimatedHours,
      stack: (project.stackJson as string[] | null) ?? [],
      objectives: (project.objectivesJson as string[] | null) ?? [],
      checklist,
      relatedTopicSlugs: (project.relatedTopicSlugsJson as string[] | null) ?? [],
      progress: {
        status: userProgress?.status ?? "NOT_STARTED",
        repositoryUrl: userProgress?.repositoryUrl ?? null,
        demoUrl: userProgress?.demoUrl ?? null,
        notes: userProgress?.notes ?? null,
        completedAt: userProgress?.completedAt ?? null,
        updatedAt: userProgress?.updatedAt ?? null,
        checklistDone: checklist.filter((_, index) => done[String(index)]).length,
        checklistTotal: checklist.length,
      },
    };
  });
}

export async function getProjectDetail(userId: string, slug: string) {
  const project = await prisma.project.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      order: true,
      difficulty: true,
      estimatedHours: true,
      stackJson: true,
      objectivesJson: true,
      checklistJson: true,
      relatedTopicSlugsJson: true,
      userProgress: {
        where: { userId },
        select: {
          status: true,
          repositoryUrl: true,
          demoUrl: true,
          notes: true,
          checklistJson: true,
          completedAt: true,
        },
      },
    },
  });

  if (!project) return null;

  const relatedSlugs = (project.relatedTopicSlugsJson as string[] | null) ?? [];
  const relatedTopics = relatedSlugs.length
    ? await prisma.topic.findMany({
        where: { slug: { in: relatedSlugs }, isActive: true },
        select: {
          slug: true,
          title: true,
          difficulty: true,
          userProgress: {
            where: { userId },
            select: { status: true },
            take: 1,
          },
          group: { select: { phase: { select: { title: true, order: true } } } },
        },
      })
    : [];

  return {
    id: project.id,
    slug: project.slug,
    title: project.title,
    description: project.description,
    order: project.order,
    difficulty: project.difficulty,
    estimatedHours: project.estimatedHours,
    stack: (project.stackJson as string[] | null) ?? [],
    objectives: (project.objectivesJson as string[] | null) ?? [],
    checklist: (project.checklistJson as string[] | null) ?? [],
    relatedTopics,
    progress: project.userProgress[0] ?? null,
  };
}

export async function getProjectStats(userId: string) {
  const [total, completed, inProgress, abandoned] = await Promise.all([
    prisma.project.count(),
    prisma.userProjectProgress.count({ where: { userId, status: "COMPLETED" } }),
    prisma.userProjectProgress.count({ where: { userId, status: "IN_PROGRESS" } }),
    prisma.userProjectProgress.count({ where: { userId, status: "ABANDONED" } }),
  ]);

  return { total, completed, inProgress, abandoned };
}