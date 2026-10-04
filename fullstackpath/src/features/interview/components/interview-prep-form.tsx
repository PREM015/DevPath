"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Calendar, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveInterviewPrepAction } from "@/server/actions/interview-kit";

/**
 * Sets the interview being prepared for.
 *
 * The date is used to build a dated plan, so it is a real date input rather than
 * free text. It is never used to predict an outcome — only to sequence work.
 */
export function InterviewPrepForm({
  initial,
}: {
  initial: { company: string; role: string; level: string; interviewDate: string };
}) {
  const router = useRouter();
  const [company, setCompany] = React.useState(initial.company);
  const [role, setRole] = React.useState(initial.role);
  const [level, setLevel] = React.useState(initial.level);
  const [date, setDate] = React.useState(initial.interviewDate);
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const result = await saveInterviewPrepAction({
      company: company || undefined,
      role: role || undefined,
      level: level || undefined,
      // No date means "no interview scheduled yet", which is a valid state.
      ...(date ? { interviewDate: new Date(`${date}T09:00:00Z`).toISOString() } : {}),
    });

    setPending(false);
    setMessage(
      result.ok
        ? { kind: "ok", text: result.message }
        : { kind: "error", text: result.error },
    );
    if (result.ok) router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={company}
          onChange={(event) => setCompany(event.target.value)}
          placeholder="Company"
          aria-label="Company"
        />
        <Input
          value={role}
          onChange={(event) => setRole(event.target.value)}
          placeholder="Role"
          aria-label="Role"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Input
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          placeholder="Level (e.g. mid, senior)"
          aria-label="Level"
        />
        <div className="relative">
          <Calendar
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            type="date"
            min={today}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-label="Interview date"
            className="pl-8"
          />
        </div>
      </div>

      {message && (
        <p
          role="status"
          className={
            message.kind === "ok"
              ? "text-xs text-green-600 dark:text-green-400"
              : "text-xs text-destructive"
          }
        >
          {message.text}
        </p>
      )}

      <Button type="submit" size="sm" variant="outline" loading={pending} className="w-full">
        <Save />
        Save interview
      </Button>
    </form>
  );
}
