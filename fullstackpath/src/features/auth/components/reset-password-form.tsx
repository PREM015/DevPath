"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { KeyRound, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { resetPasswordSchema } from "@/lib/validations/auth";
import { resetPasswordAction } from "@/server/actions/auth";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(
    token ? null : "This reset link is missing its token. Request a new one.",
  );
  const [pending, startTransition] = useTransition();

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields({});

    const parsed = resetPasswordSchema.safeParse({ token, password, confirmPassword });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        next[String(issue.path[0])] ??= issue.message;
      }
      setFields(next);
      return;
    }

    startTransition(async () => {
      const result = await resetPasswordAction(parsed.data);
      if (result.status === "error") {
        setError(result.message);
        if (result.fields) setFields(result.fields);
        return;
      }
      router.push("/login?reset=1");
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          {error}
        </div>
      )}

      <Field label="New password" htmlFor="password" error={fields.password} required>
        <div className="relative">
          <KeyRound
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            placeholder="At least 8 characters"
            className="pl-9 pr-10"
            value={password}
            invalid={Boolean(fields.password)}
            disabled={!token}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground transition-colors hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      <Field label="Confirm new password" htmlFor="confirmPassword" error={fields.confirmPassword} required>
        <Input
          id="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          placeholder="Repeat your new password"
          value={confirmPassword}
          invalid={Boolean(fields.confirmPassword)}
          disabled={!token}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </Field>

      <Button type="submit" className="w-full" size="lg" loading={pending} loadingText="Updating…" disabled={!token}>
        Update password
      </Button>

      <Link
        href="/forgot-password"
        className="block text-center text-xs text-muted-foreground transition-colors hover:text-primary"
      >
        Request a new link
      </Link>
    </form>
  );
}