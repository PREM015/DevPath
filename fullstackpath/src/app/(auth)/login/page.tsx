import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "@/features/auth/components/login-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your FullStackPath account to continue your roadmap.",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  const { reset } = await searchParams;

  return (
    <Card className="animate-fade-in-up shadow-card">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Welcome back</CardTitle>
        <CardDescription>Sign in to pick up where you left off.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {reset && (
          <div
            role="status"
            className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-sm text-green-600 dark:text-green-400"
          >
            Your password has been updated. Sign in with your new password.
          </div>
        )}

        <Suspense fallback={<div className="h-64 animate-pulse-soft rounded-lg bg-muted" />}>
          <LoginForm />
        </Suspense>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center" aria-hidden>
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button asChild variant="outline" className="w-full" size="lg">
          <Link href="/roadmap">Browse the roadmap first</Link>
        </Button>
      </CardContent>
    </Card>
  );
}