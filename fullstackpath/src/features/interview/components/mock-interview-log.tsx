"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { logMockInterviewAction, deleteMockInterviewAction } from "@/server/actions/interview";

const KINDS = [
  { value: "CODING", label: "Coding" },
  { value: "SYSTEM_DESIGN", label: "System design" },
  { value: "BEHAVIORAL", label: "Behavioral" },
  { value: "MOCK", label: "Full mock loop" },
  { value: "SCREENING", label: "Recruiter screen" },
  { value: "OTHER", label: "Other" },
];

const OUTCOMES = [
  { value: "PENDING", label: "Awaiting result" },
  { value: "PASSED", label: "Passed" },
  { value: "OFFER", label: "Offer" },
  { value: "FAILED", label: "Did not pass" },
];

export function MockInterviewLog({
  interviews,
}: {
  interviews: {
    id: string;
    title: string;
    company: string | null;
    round: string | null;
    kind: string;
    outcome: string | null;
    difficulty: number | null;
    durationMinutes: number | null;
    notes: string | null;
    performedAt: string;
  }[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = new FormData(event.currentTarget);
    const result = await logMockInterviewAction({
      title: String(form.get("title") ?? ""),
      company: String(form.get("company") ?? "") || undefined,
      round: String(form.get("round") ?? "") || undefined,
      kind: String(form.get("kind") ?? "OTHER") as never,
      outcome: (String(form.get("outcome") ?? "") || undefined) as never,
      difficulty: form.get("difficulty") ? Number(form.get("difficulty")) : undefined,
      durationMinutes: form.get("duration") ? Number(form.get("duration")) : undefined,
      notes: String(form.get("notes") ?? "") || undefined,
    });

    setPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function remove(id: string) {
    const result = await deleteMockInterviewAction(id);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Mock interview history</h2>
        <Button size="sm" onClick={() => setOpen((value) => !value)}>
          <Plus />
          Log an interview
        </Button>
      </div>

      {open && (
        <form onSubmit={submit} className="space-y-3 rounded-xl border border-border p-4">
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="What was it" htmlFor="title" required>
              <Input id="title" name="title" required placeholder="Second interview loop" />
            </Field>
            <Field label="Company" htmlFor="company">
              <Input id="company" name="company" placeholder="Optional" />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Round" htmlFor="round">
              <Input id="round" name="round" placeholder="System design" />
            </Field>
            <Field label="Type" htmlFor="kind">
              <Select id="kind" name="kind" defaultValue="MOCK">
                {KINDS.map((kind) => (
                  <option key={kind.value} value={kind.value}>
                    {kind.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Outcome" htmlFor="outcome">
              <Select id="outcome" name="outcome" defaultValue="PENDING">
                {OUTCOMES.map((outcome) => (
                  <option key={outcome.value} value={outcome.value}>
                    {outcome.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="How hard was it (1-5)" htmlFor="difficulty">
              <Select id="difficulty" name="difficulty" defaultValue="3">
                {[1, 2, 3, 4, 5].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Duration in minutes" htmlFor="duration">
              <Input id="duration" name="duration" type="number" min={0} max={600} placeholder="60" />
            </Field>
          </div>

          <Field
            label="What went well, what to fix"
            htmlFor="notes"
            hint="Write this while it is fresh — it is the part that actually improves the next round."
          >
            <Textarea id="notes" name="notes" className="min-h-[96px]" />
          </Field>

          <Button type="submit" loading={pending} loadingText="Saving…">
            Save entry
          </Button>
        </form>
      )}

      {interviews.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
          Log your interviews after each round. The history is where you spot the pattern between
          what you prepare and what they actually ask.
        </p>
      ) : (
        <ul className="space-y-2">
          {interviews.map((interview) => (
            <li
              key={interview.id}
              className="group flex items-start gap-3 rounded-lg border border-border px-3 py-2.5"
            >
              <MessagesSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {interview.title}
                  {interview.company && (
                    <span className="font-normal text-muted-foreground"> · {interview.company}</span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(
                    new Date(interview.performedAt),
                  )}{" "}
                  · {interview.kind.replace(/_/g, " ").toLowerCase()}
                  {interview.round && ` · ${interview.round}`}
                  {interview.difficulty && ` · difficulty ${interview.difficulty}/5`}
                  {interview.durationMinutes && ` · ${interview.durationMinutes} min`}
                </p>
                {interview.notes && (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{interview.notes}</p>
                )}
              </div>
              {interview.outcome && (
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px]">
                  {interview.outcome.toLowerCase()}
                </span>
              )}
              <button
                onClick={() => remove(interview.id)}
                className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`Delete ${interview.title}`}
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}