import type { Metadata } from "next";
import Link from "next/link";
import {
  Archive,
  ArrowUp,
  ArrowDown,
  FileText,
  FolderTree,
  Shield,
  Users,
  Plus,
} from "lucide-react";
import { requireAdminPage } from "@/lib/permissions";
import { prisma } from "@/lib/db/prisma";
import {
  createPhaseAction,
  createTopicAction,
  reorderAction,
  setTopicArchivedAction,
  updateGroupAction,
  updatePhaseAction,
  updateTopicAction,
} from "@/server/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { PageHeader, StatCard } from "@/components/ui/feedback";
import { formatDateTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Admin",
  description: "Roadmap content management and user administration.",
  robots: { index: false, follow: false },
};

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ phase?: string }>;
}) {
  await requireAdminPage();
  const { phase: phaseFilter } = await searchParams;

  const [phases, topicCount, groupCount, archivedCount, recentAudit] = await Promise.all([
    prisma.phase.findMany({
      where: { isActive: true },
      orderBy: { order: "asc" },
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        order: true,
        difficulty: true,
        color: true,
        estimatedHours: true,
        groups: {
          where: { isActive: true },
          orderBy: { order: "asc" },
          select: {
            id: true,
            title: true,
            description: true,
            difficulty: true,
            order: true,
            topics: {
              where: { isActive: true },
              orderBy: { order: "asc" },
              select: {
                id: true,
                slug: true,
                title: true,
                description: true,
                difficulty: true,
                estimatedMinutes: true,
                _count: { select: { userProgress: true } },
              },
            },
          },
        },
      },
    }),
    prisma.topic.count({ where: { isActive: true } }),
    prisma.roadmapGroup.count({ where: { isActive: true } }),
    prisma.topic.count({ where: { isActive: false } }),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      select: { id: true, action: true, summary: true, actorEmail: true, createdAt: true },
    }),
  ]);

  const visiblePhases = phaseFilter
    ? phases.filter((phase) => phase.id === phaseFilter || phase.slug === phaseFilter)
    : phases;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        title="Admin dashboard"
        description="Edit roadmap content, manage users and review the audit log. Content edits never delete learner progress."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link href="/admin/users">
                <Users />
                Users
              </Link>
            </Button>
            <NewPhaseForm />
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Phases" value={phases.length} icon={FolderTree} />
        <StatCard label="Groups" value={groupCount} icon={FolderTree} tone="info" />
        <StatCard label="Active topics" value={topicCount} icon={FileText} />
        <StatCard
          label="Archived topics"
          value={archivedCount}
          sublabel="progress preserved"
          icon={Archive}
          tone="muted"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filter by phase</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1.5">
          <Button asChild size="xs" variant={phaseFilter ? "outline" : "subtle"}>
            <Link href="/admin">All</Link>
          </Button>
          {phases.map((phase) => (
            <Button key={phase.id} asChild size="xs" variant={phaseFilter === phase.id ? "subtle" : "outline"}>
              <Link href={`/admin?phase=${phase.id}`}>{phase.order}. {phase.title}</Link>
            </Button>
          ))}
        </CardContent>
      </Card>

      {visiblePhases.map((phase) => (
        <PhaseEditor key={phase.id} phase={phase} totalPhases={phases.length} />
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="size-4 text-primary" aria-hidden />
            Audit log
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No admin actions recorded yet.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recentAudit.map((entry) => (
                <li key={entry.id} className="flex items-start gap-3 py-2 text-xs">
                  <Badge variant="outline" className="shrink-0">
                    {entry.action}
                  </Badge>
                  <span className="min-w-0 flex-1 text-muted-foreground">{entry.summary}</span>
                  <span className="shrink-0 text-muted-foreground/70">
                    {entry.actorEmail ?? "system"} · {formatDateTime(entry.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type PhaseShape = {
  id: string;
  slug: string;
  title: string;
  description: string;
  order: number;
  difficulty: string;
  color: string;
  estimatedHours: number | null;
  groups: {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    order: number;
    topics: {
      id: string;
      slug: string;
      title: string;
      description: string;
      difficulty: string;
      estimatedMinutes: number;
      _count: { userProgress: number };
    }[];
  }[];
};

function PhaseEditor({ phase, totalPhases }: { phase: PhaseShape; totalPhases: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <span className="size-3 rounded-full" style={{ backgroundColor: phase.color }} aria-hidden />
          Phase {phase.order}: {phase.title}
          <Badge variant="outline">{phase.difficulty.toLowerCase()}</Badge>
          {phase.estimatedHours && <Badge variant="outline">~{phase.estimatedHours}h</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <PhaseForm phase={phase} totalPhases={totalPhases} />

        {phase.groups.length === 0 ? (
          <p className="text-sm text-muted-foreground">This phase has no groups yet.</p>
        ) : (
          phase.groups.map((group) => <GroupEditor key={group.id} group={group} />)
        )}

        <NewTopicForm groupId={phase.groups[0]?.id} />
      </CardContent>
    </Card>
  );
}

function PhaseForm({ phase, totalPhases }: { phase: PhaseShape; totalPhases: number }) {
  return (
    <form className="grid gap-3" action={async (formData) => {
      "use server";
      await updatePhaseAction({
        id: phase.id,
        title: String(formData.get("title") ?? ""),
        description: String(formData.get("description") ?? ""),
        difficulty: String(formData.get("difficulty") ?? "BEGINNER") as never,
        color: String(formData.get("color") ?? phase.color),
        estimatedHours: Number(formData.get("estimatedHours") ?? 0) || undefined,
      });
    }}>
      <div className="grid gap-3 sm:grid-cols-[1fr_160px_120px]">
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor={`title-${phase.id}`}>
            Title
          </label>
          <Input id={`title-${phase.id}`} name="title" defaultValue={phase.title} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor={`difficulty-${phase.id}`}>
            Difficulty
          </label>
          <select
            id={`difficulty-${phase.id}`}
            name="difficulty"
            defaultValue={phase.difficulty}
            className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="BEGINNER">Beginner</option>
            <option value="INTERMEDIATE">Intermediate</option>
            <option value="ADVANCED">Advanced</option>
            <option value="SENIOR">Senior</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium" htmlFor={`hours-${phase.id}`}>
            Est. hours
          </label>
          <Input
            id={`hours-${phase.id}`}
            name="estimatedHours"
            type="number"
            min={0}
            defaultValue={phase.estimatedHours ?? 0}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium" htmlFor={`description-${phase.id}`}>
          Description
        </label>
        <Textarea
          id={`description-${phase.id}`}
          name="description"
          defaultValue={phase.description}
          rows={3}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="sm">
          Save phase
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={phase.order <= 1}
          formAction={async () => {
            "use server";
            const all = await prisma.phase.findMany({
              where: { isActive: true },
              orderBy: { order: "asc" },
              select: { id: true },
            });
            const ids = all.map((row) => row.id);
            const index = ids.indexOf(phase.id);
            if (index > 0) {
              ids.splice(index, 1);
              ids.splice(index - 1, 0, phase.id);
            }
            await reorderAction({ kind: "phase", ids });
          }}
        >
          <ArrowUp />
          Move up
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={phase.order >= totalPhases}
          formAction={async () => {
            "use server";
            const all = await prisma.phase.findMany({
              where: { isActive: true },
              orderBy: { order: "asc" },
              select: { id: true },
            });
            const ids = all.map((row) => row.id);
            const index = ids.indexOf(phase.id);
            if (index >= 0 && index < ids.length - 1) {
              ids.splice(index, 1);
              ids.splice(index + 1, 0, phase.id);
            }
            await reorderAction({ kind: "phase", ids });
          }}
        >
          <ArrowDown />
          Move down
        </Button>
      </div>
    </form>
  );
}

function GroupEditor({
  group,
}: {
  group: PhaseShape["groups"][number];
}) {
  return (
    <details className="rounded-lg border border-border">
      <summary className="cursor-pointer px-3 py-2.5 text-sm font-medium">
        {group.title}
        <span className="ml-2 text-xs text-muted-foreground">
          {group.topics.length} topics · {group.difficulty.toLowerCase()}
        </span>
      </summary>
      <div className="space-y-3 border-t border-border p-3">
        <form
          className="space-y-2"
          action={async (formData) => {
            "use server";
            await updateGroupAction({
              id: group.id,
              title: String(formData.get("title") ?? ""),
              description: String(formData.get("description") ?? ""),
              difficulty: String(formData.get("difficulty") ?? "BEGINNER") as never,
            });
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[1fr_160px]">
            <Input name="title" defaultValue={group.title} aria-label={`Title for ${group.title}`} />
            <select
              name="difficulty"
              defaultValue={group.difficulty}
              aria-label={`Difficulty for ${group.title}`}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
              <option value="SENIOR">Senior</option>
            </select>
          </div>
          <Textarea
            name="description"
            defaultValue={group.description}
            rows={2}
            aria-label={`Description for ${group.title}`}
          />
          <Button type="submit" size="xs">
            Save group
          </Button>
        </form>

        <div className="space-y-2">
          {group.topics.map((topic) => (
            <TopicRow key={topic.id} topic={topic} />
          ))}
        </div>
      </div>
    </details>
  );
}

function TopicRow({ topic }: { topic: PhaseShape["groups"][number]["topics"][number] }) {
  return (
    <details className="rounded-md border border-border/70">
      <summary className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-sm">
        <span className="min-w-0 flex-1 truncate">{topic.title}</span>
        <Badge variant="outline" className="shrink-0">
          {topic.difficulty.toLowerCase()}
        </Badge>
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {topic._count.userProgress} learners
        </span>
      </summary>

      <div className="space-y-2 border-t border-border/70 p-2.5">
        <form
          className="space-y-2"
          action={async (formData) => {
            "use server";
            await updateTopicAction({
              id: topic.id,
              title: String(formData.get("title") ?? ""),
              description: String(formData.get("description") ?? ""),
              difficulty: String(formData.get("difficulty") ?? "BEGINNER") as never,
              estimatedMinutes: Number(formData.get("estimatedMinutes") ?? 60) || 60,
            });
          }}
        >
          <Input name="title" defaultValue={topic.title} aria-label={`Title for ${topic.title}`} />
          <Textarea
            name="description"
            defaultValue={topic.description}
            rows={2}
            aria-label={`Description for ${topic.title}`}
          />
          <div className="flex gap-2">
            <select
              name="difficulty"
              defaultValue={topic.difficulty}
              aria-label={`Difficulty for ${topic.title}`}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm"
            >
              <option value="BEGINNER">Beginner</option>
              <option value="INTERMEDIATE">Intermediate</option>
              <option value="ADVANCED">Advanced</option>
              <option value="SENIOR">Senior</option>
            </select>
            <Input
              name="estimatedMinutes"
              type="number"
              min={5}
              defaultValue={topic.estimatedMinutes}
              aria-label={`Estimated minutes for ${topic.title}`}
              className="max-w-28"
            />
          </div>
          <Button type="submit" size="xs">
            Save topic
          </Button>
        </form>

        <form
          action={async () => {
            "use server";
            await setTopicArchivedAction({ topicId: topic.id, archived: true });
          }}
        >
          <Button type="submit" size="xs" variant="outline" className="text-destructive">
            <Archive />
            Archive topic
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground">
          Archiving hides this topic from roadmaps. {topic._count.userProgress} learner progress
          records are kept.
        </p>
      </div>
    </details>
  );
}

function NewPhaseForm() {
  return (
    <form
      className="flex items-center gap-2"
      action={async (formData) => {
        "use server";
        await createPhaseAction({
          title: String(formData.get("title") ?? ""),
          description: String(formData.get("description") ?? ""),
        });
      }}
    >
      <Input name="title" placeholder="New phase title" className="w-48" aria-label="New phase title" required />
      <Input
        name="description"
        placeholder="What this phase covers"
        className="w-64"
        aria-label="New phase description"
        required
      />
      <Button type="submit" size="sm">
        <Plus />
        Add phase
      </Button>
    </form>
  );
}

function NewTopicForm({ groupId }: { groupId?: string }) {
  if (!groupId) return null;

  return (
    <form
      className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3"
      action={async (formData) => {
        "use server";
        await createTopicAction({
          groupId: groupId || String(formData.get("groupId")),
          title: String(formData.get("title") ?? ""),
          description: String(formData.get("description") ?? ""),
        });
      }}
    >
      <input type="hidden" name="groupId" value={groupId} />
      <Input name="title" placeholder="New topic title" className="w-56" aria-label="New topic title" required />
      <Input
        name="description"
        placeholder="Description"
        className="min-w-64 flex-1"
        aria-label="New topic description"
        required
      />
      <Button type="submit" size="sm" variant="outline">
        <Plus />
        Add topic
      </Button>
    </form>
  );
}