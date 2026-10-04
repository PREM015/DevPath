import { PHASE_OUTLINE } from "@/features/roadmap/phase-outline-data";
import { cn } from "@/lib/utils";

const DIFFICULTY_CLASSES: Record<string, string> = {
  BEGINNER: "diff-beginner",
  INTERMEDIATE: "diff-intermediate",
  ADVANCED: "diff-advanced",
  SENIOR: "diff-senior",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  SENIOR: "Senior",
};

/**
 * Static roadmap outline shown on the landing page.
 *
 * Uses native `<details>` so the whole thing works without JavaScript and is
 * keyboard accessible. Counts come from the generated outline module, which is
 * derived from the same seed data the database is loaded from.
 */
export function PhaseOutline() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {PHASE_OUTLINE.phases.map((phase) => (
        <details
          key={phase.order}
          className="group rounded-xl border border-border bg-card transition-colors open:border-primary/40 hover:border-primary/30"
        >
          <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-base"
              style={{ backgroundColor: `${phase.color}22` }}
              aria-hidden
            >
              {phase.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Phase {phase.order}
              </span>
              <span className="block text-sm font-semibold leading-snug">{phase.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {phase.groups.length} groups · {phase.topics} topics
                {phase.questions > 0 && ` · ${phase.questions} questions`}
              </span>
            </span>
            <span
              className={cn(
                "mt-1 shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                DIFFICULTY_CLASSES[phase.difficulty],
              )}
            >
              {DIFFICULTY_LABELS[phase.difficulty]}
            </span>
          </summary>

          <div className="border-t border-border px-4 py-3">
            <p className="mb-2.5 text-xs leading-relaxed text-muted-foreground">
              {phase.summary}
            </p>

            {phase.questions === 0 ? (
              // Honest labelling: the outline exists, the written content does not.
              <p className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                Outline only — {phase.topics} topics are mapped but this phase is still being
                written. No questions or drills yet.
              </p>
            ) : (
              <p className="mb-2.5 text-xs text-muted-foreground">
                {phase.deepTopics} of {phase.topics} topics written ·{" "}
                {phase.answeredQuestions} of {phase.questions} questions have a model answer
                {phase.practiceBlocks > 0 &&
                  ` · ${phase.practiceBlocks} practice block${phase.practiceBlocks === 1 ? "" : "s"}`}
              </p>
            )}

            <ul className="space-y-1">
              {phase.groups.slice(0, 6).map((group) => (
                <li key={group} className="flex gap-2 text-xs text-muted-foreground">
                  <span
                    className="mt-1.5 size-1 shrink-0 rounded-full"
                    style={{ backgroundColor: phase.color }}
                    aria-hidden
                  />
                  {group}
                </li>
              ))}
              {phase.groups.length > 6 && (
                <li className="pl-3 text-xs text-muted-foreground/70">
                  + {phase.groups.length - 6} more groups
                </li>
              )}
            </ul>
          </div>
        </details>
      ))}
    </div>
  );
}