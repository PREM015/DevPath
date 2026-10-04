"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailCheck, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { verifyEmailSchema } from "@/lib/validations/auth";
import { resendVerificationAction, verifyEmailAction } from "@/server/actions/auth";

export function VerifyEmailForm({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [resending, startResending] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const parsed = verifyEmailSchema.safeParse({ code });
    if (!parsed.success) {
      setError(parsed.error.issues[0]!.message);
      return;
    }

    startTransition(async () => {
      const result = await verifyEmailAction(parsed.data);
      if (result.status === "error") {
        setError(result.message);
        return;
      }
      setMessage(result.message);
      router.refresh();
    });
  }

  function onResend() {
    startResending(async () => {
      const result = await resendVerificationAction();
      if (result.status === "error") setError(result.message);
      else setMessage(result.message);
    });
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
      {message && (
        <div
          role="status"
          className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-sm text-green-600 dark:text-green-400"
        >
          {message}
        </div>
      )}

      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-11 items-center justify-center rounded-xl bg-primary/10">
          <MailCheck className="size-5 text-primary" />
        </div>
        <p className="text-sm text-muted-foreground">
          We sent a 6-digit code to <span className="text-foreground">{email}</span>.
        </p>
      </div>

      <Field label="Verification code" htmlFor="code" required>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          required
          placeholder="123456"
          className="text-center font-mono text-lg tracking-[0.5em]"
          value={code}
          invalid={Boolean(error)}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </Field>

      <Button type="submit" className="w-full" size="lg" loading={pending} loadingText="Verifying…">
        Verify email
      </Button>

      <Button type="button" variant="ghost" className="w-full" loading={resending} onClick={onResend}>
        <RefreshCw />
        Send a new code
      </Button>
    </form>
  );
}