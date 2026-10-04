"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, Mail, KeyRound, User2, Eye, EyeOff, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Field } from "@/components/ui/label";
import { registerSchema } from "@/lib/validations/auth";
import { registerUserAction } from "@/server/actions/auth";
import { LEARNER_ROLES, TARGET_LEVELS } from "@/config";
import { cn } from "@/lib/utils";

type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; checks: boolean[] };

const CHECKS = [
  { label: "8+ characters", test: (v: string) => v.length >= 8 },
  { label: "Lowercase letter", test: (v: string) => /[a-z]/.test(v) },
  { label: "Uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "Number", test: (v: string) => /[0-9]/.test(v) },
];

function scorePassword(password: string): Strength {
  const checks = CHECKS.map((c) => c.test(password));
  const score = checks.filter(Boolean).length as Strength["score"];
  const label =
    score <= 0 ? "Too weak" : score === 1 ? "Very weak" : score === 2 ? "Weak" : score === 3 ? "Good" : "Strong";
  return { score, label, checks };
}

const BAR_COLORS = [
  "bg-muted",
  "bg-red-500",
  "bg-orange-500",
  "bg-yellow-500",
  "bg-green-500",
];

export function RegisterForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [preferredRole, setPreferredRole] = useState<string>("BALANCED");
  const [targetLevel, setTargetLevel] = useState<string>("MID");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const strength = useMemo(() => scorePassword(password), [password]);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFields({});

    const parsed = registerSchema.safeParse({
      name,
      email,
      password,
      confirmPassword,
      preferredRole,
      targetLevel,
      acceptTerms,
    });

    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        next[String(issue.path[0])] ??= issue.message;
      }
      setFields(next);
      return;
    }

    startTransition(async () => {
      const result = await registerUserAction({
        ...parsed.data,
        preferredRole: parsed.data.preferredRole as "FRONTEND" | "BACKEND" | "BALANCED" | "STARTUP",
        targetLevel: parsed.data.targetLevel as "JUNIOR" | "MID" | "SENIOR" | "STAFF",
      });

      if (result.status === "error") {
        setError(result.message);
        if (result.fields) setFields(result.fields);
        return;
      }

      // Sign the new user straight in; email verification can be completed later.
      const signInResult = await signIn("credentials", {
        email: parsed.data.email,
        password: parsed.data.password,
        redirect: false,
      });

      router.push(signInResult?.error ? "/verify-email" : "/dashboard");
      router.refresh();
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

      <Field label="Name" htmlFor="name" error={fields.name} required>
        <div className="relative">
          <User2
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="name"
            name="name"
            autoComplete="name"
            required
            placeholder="Your name"
            className="pl-9"
            value={name}
            invalid={Boolean(fields.name)}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
      </Field>

      <Field label="Email" htmlFor="email" error={fields.email} required>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            className="pl-9"
            value={email}
            invalid={Boolean(fields.email)}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </Field>

      <Field label="Password" htmlFor="password" error={fields.password} required>
        <div className="relative">
          <KeyRound
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            placeholder="Create a password"
            className="pl-9 pr-10"
            value={password}
            invalid={Boolean(fields.password)}
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

      <div className="space-y-2" aria-live="polite">
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i < strength.score ? BAR_COLORS[strength.score] : "bg-muted",
              )}
            />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Password strength: <span className="text-foreground">{strength.label}</span>
        </p>
        <ul className="grid grid-cols-2 gap-1">
          {CHECKS.map((check, i) => (
            <li
              key={check.label}
              className={cn(
                "flex items-center gap-1 text-xs",
                strength.checks[i] ? "text-green-600 dark:text-green-400" : "text-muted-foreground",
              )}
            >
              <Check className={cn("size-3", !strength.checks[i] && "opacity-30")} aria-hidden />
              {check.label}
            </li>
          ))}
        </ul>
      </div>

      <Field label="Confirm password" htmlFor="confirmPassword" error={fields.confirmPassword} required>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          required
          placeholder="Repeat your password"
          value={confirmPassword}
          invalid={Boolean(fields.confirmPassword)}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Target role" htmlFor="preferredRole" hint="You can change this any time.">
          <Select
            id="preferredRole"
            value={preferredRole}
            onChange={(e) => setPreferredRole(e.target.value)}
          >
            {LEARNER_ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Target level" htmlFor="targetLevel">
          <Select id="targetLevel" value={targetLevel} onChange={(e) => setTargetLevel(e.target.value)}>
            {TARGET_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="space-y-1.5">
        <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 size-3.5 shrink-0 accent-primary"
            aria-describedby={fields.acceptTerms ? "terms-error" : undefined}
          />
          <span>
            I understand this platform tracks my own progress and does not guarantee a job outcome.
          </span>
        </label>
        {fields.acceptTerms && (
          <p className="text-xs text-destructive" role="alert">
            {fields.acceptTerms}
          </p>
        )}
      </div>

      <Button type="submit" className="w-full" size="lg" loading={pending} loadingText="Creating account…">
        Create account
        <ArrowRight />
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}