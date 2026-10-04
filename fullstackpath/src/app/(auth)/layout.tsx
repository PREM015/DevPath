import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { APP_NAME } from "@/config";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <div className="absolute -left-40 top-0 size-[28rem] rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute -right-32 top-1/3 size-96 rounded-full bg-purple-500/10 blur-3xl" />
      </div>

      <header className="relative flex items-center justify-between px-5 py-5">
        <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
          <span aria-hidden className="text-lg">🗺️</span>
          <span className="gradient-text">{APP_NAME}</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 pb-16 pt-6">
        <div className="w-full max-w-md">
          <Suspense fallback={null}>{children}</Suspense>
        </div>
      </main>
    </div>
  );
}