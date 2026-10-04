"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { forgotPasswordSchema } from "@/lib/validations/auth";
import { forgotPasswordAction } from "@/server/actions/auth";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = forgotPasswordSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }

    startTransition(async () => {
      const result = await forgotPasswordAction(parsed.data);
      // The same confirmation is shown either way, so this cannot be used to
      // discover which email addresses have accounts.
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setSent(true);
    });
  }

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex size-11 items-center justify-center rounded-xl bg-green-500/10">
          <CheckCircle2 className="size-5 text-green-600 dark:text-green-400" />
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium text-foreground">Check your inbox</p>
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="text-foreground">{email}</span>, a reset
            link is on its way. It expires in one hour.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          No email after a few minutes? Check spam, or make sure the address is the one you
          signed up with.
        </p>
        <Button variant="outline" onClick={() => router.push("/login")} className="w-full">
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <Field label="Email" htmlFor="email" required>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="email"
            type="email"
            name="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="pl-9"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </Field>

      <Button type="submit" className="w-full" size="lg" loading={pending} loadingText="Sending…">
        Send reset link
      </Button>

      <Link
        href="/login"
        className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-primary"
      >
        <ArrowLeft className="size-3.5" />
        Back to sign in
      </Link>
    </form>
  );
}