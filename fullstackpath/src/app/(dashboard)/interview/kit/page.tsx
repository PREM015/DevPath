import type { Metadata } from "next";
import Link from "next/link";
import { requireUserPage } from "@/lib/permissions";
import { getPracticeBlocks, getPracticeStats } from "@/server/services/interview-kit";
import { PracticeBlockCard, PRACTICE_LABELS } from "@/features/interview/components/practice-block-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/primitives";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/feedback";
import { Wrench } from "lucide-react";
import type { PracticeKind } from "@/generated/prisma/enums";

export const metadata: Metadata = {
  title: "Practice kit",
  description:
    "Debugging scenarios, drills, rapid-fire sets, machine-coding prompts and readiness checklists.",
};

const KINDS: { value: PracticeKind; label: string }[] = [
  { value: "SCENARIO", label: "Scenarios" },
  { value: "DRILL", label: "Drills" },
  { value: "RAPIDFIRE", label: "Rapid-fire" },
  { value: "MACHINE_CODING", label: "Machine coding" },
  { value: "QA", label: "Q&A" },
  { value: "CHECKLIST", label: "Checklists" },
  { value: "REFERENCE", label: "Reference" },
];

export default async function KitPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; phase?: string }>;
}) {
  const sessionUser = await requireUserPage();
  const params = await searchParams;

  const kind = KINDS.find((entry) => entry.value === params.kind)?.value;
  const phaseId = params.phase;

  const [blocks, stats] = await Promise.all([
    getPracticeBlocks(sessionUser.id, { kind, phaseId }),
    getPracticeStats(sessionUser.id),
  ]);

  // Group by phase so the kit reads in roadmap order.
  const byPhase = new Map<string, { title: string; order: number; color: string; blocks: typeof blocks }>();
  for (const block of blocks) {
    const existing = byPhase.get(block.phaseId);
    if (existing) existing.blocks.push(block);
    else
      byPhase.set(block.phaseId, {
        title: block.phaseTitle,
        order: block.phaseOrder,
        color: block.phaseColor,
        blocks: [block],
      });
  }

  const phases = [...byPhase.values()].sort((a, b) => a.order - b.order);
  const completion =
    stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <PageHeader
        title="Practice kit"
        description="The material you rehearse against: debugging scenarios you must diagnose yourself, drills with an answer to check, and per-phase readiness checklists."
        actions={
          <Button asChild size="sm" variant="outline">
            <Link href="/interview">Back to prep</Link>
          </Button>
        }
      />

      {stats.total === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No practice blocks loaded"
          description="Run the database seed to load the drills, scenarios and checklists from the roadmap content."
          action={<code className="rounded bg-muted px-2 py-1 text-xs">npx prisma db seed</code>}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatCard label="Blocks" value={stats.total} icon={Wrench} />
            <StatCard label="Cleared" value={stats.passed} tone="success" />
            <StatCard label="Needs work" value={stats.needsWork} tone="warning" />
            <Card className="p-4">
              <p className="text-xs text-muted-foreground">Overall cleared</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{completion}%</p>
              <Progress value={completion} className="mt-2" />
            </Card>
          </div>

          <Card>
            <CardContent className="flex flex-wrap gap-1.5 p-4">
              <Button asChild size="xs" variant={kind ? "outline" : "subtle"}>
                <Link href="/interview/kit">All ({stats.total})</Link>
              </Button>
              {KINDS.map((entry) => {
                const count = stats.byKind[entry.value] ?? 0;
                if (count === 0) return null;
                return (
                  <Button
                    key={entry.value}
                    asChild
                    size="xs"
                    variant={kind === entry.value ? "subtle" : "outline"}
                  >
                    <Link href={`/interview/kit?kind=${entry.value}`}>
                      {entry.label} ({count})
                    </Link>
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          {phases.map((phase) => (
            <section key={phase.title} className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: phase.color }}
                  aria-hidden
                />
                {phase.title}
                <span className="text-xs font-normal text-muted-foreground">
                  {phase.blocks.length} block{phase.blocks.length === 1 ? "" : "s"}
                </span>
              </h2>
              <div className="space-y-2">
                {phase.blocks.map((block) => (
                  <PracticeBlockCard
                    key={block.id}
                    block={block}
                    phaseTitle={PRACTICE_LABELS[block.kind] ?? block.kind}
                    phaseColor={phase.color}
                  />
                ))}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
