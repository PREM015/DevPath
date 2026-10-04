"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  BookOpen,
  RefreshCw,
  ChartNoAxesColumn,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/learning", label: "Learn", icon: BookOpen },
  { href: "/revision", label: "Revise", icon: RefreshCw },
  { href: "/analytics", label: "Stats", icon: ChartNoAxesColumn },
];

const MORE_ITEMS = [
  { href: "/notes", label: "Notes" },
  { href: "/projects", label: "Projects" },
  { href: "/interview", label: "Interview prep" },
  { href: "/settings", label: "Settings" },
];

/**
 * Mobile navigation.
 *
 * A bottom bar for the five most frequent destinations plus a sheet for the
 * rest, so nothing is more than one tap away on a phone.
 */
export function MobileNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const isMoreActive = MORE_ITEMS.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <>
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur-md lg:hidden"
        aria-label="Primary"
      >
        <ul className="flex items-stretch justify-around px-1 py-1">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={cn(
                "flex w-full flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors",
                isMoreActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <MoreHorizontal className="size-5" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      {moreOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="More navigation"
        >
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
            aria-label="Close menu"
          />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-card p-4 pb-8 shadow-card-hover">
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" aria-hidden />
            <ul className="grid grid-cols-2 gap-2">
              {MORE_ITEMS.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className="block rounded-lg border border-border px-4 py-3 text-sm font-medium transition-colors hover:bg-secondary"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}