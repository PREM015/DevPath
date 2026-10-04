"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Map,
  BookOpen,
  ChartNoAxesColumn,
  RefreshCw,
  NotebookPen,
  FolderGit2,
  Settings,
  Shield,
  ChevronsLeft,
  ChevronsRight,
  Target,
  HelpCircle,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { APP_NAME } from "@/config";
import { useSidebar } from "./sidebar-context";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/primitives";

export const NAV_SECTIONS = [
  {
    label: "Interview",
    items: [
      // Interview prep is the product, so it leads the navigation.
      { href: "/interview", label: "Interview prep", icon: Target },
      { href: "/interview/questions", label: "Question bank", icon: HelpCircle },
      { href: "/interview/kit", label: "Drills and scenarios", icon: Wrench },
    ],
  },
  {
    label: "Roadmap",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/roadmap", label: "Roadmap", icon: Map },
      { href: "/learning", label: "My learning", icon: BookOpen },
    ],
  },
  {
    label: "Track",
    items: [
      { href: "/revision", label: "Revision", icon: RefreshCw },
      { href: "/analytics", label: "Analytics", icon: ChartNoAxesColumn },
    ],
  },
  {
    label: "Library",
    items: [
      { href: "/notes", label: "Notes", icon: NotebookPen },
      { href: "/projects", label: "Projects", icon: FolderGit2 },
    ],
  },
  {
    label: "Account",
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
] as const;

export const ADMIN_ITEM = { href: "/admin", label: "Admin", icon: Shield } as const;

export function Sidebar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();

  const sections = isAdmin ? [...NAV_SECTIONS, { label: "Admin", items: [ADMIN_ITEM] }] : NAV_SECTIONS;

  return (
    <aside
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-sidebar/60 backdrop-blur-sm lg:flex",
        "transition-[width] duration-200 ease-out",
        collapsed ? "w-16" : "w-60",
      )}
    >
      <div
        className={cn(
          "flex h-14 shrink-0 items-center border-b border-border",
          collapsed ? "justify-center px-2" : "gap-2 px-4",
        )}
      >
        <Link href="/dashboard" className="flex min-w-0 items-center gap-2" aria-label={`${APP_NAME} home`}>
          <span aria-hidden className="text-lg">🗺️</span>
          {!collapsed && <span className="gradient-text truncate text-sm font-bold">{APP_NAME}</span>}
        </Link>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto p-2" aria-label="Main navigation">
        {sections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/70">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const link = (
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn("nav-link", active && "nav-link-active", collapsed && "justify-center px-0")}
                  >
                    <Icon className="size-4 shrink-0" aria-hidden />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );

                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-2">
        <button
          onClick={toggle}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronsRight className="size-3.5" aria-hidden />
          ) : (
            <>
              <ChevronsLeft className="size-3.5" aria-hidden />
              <span>Collapse</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}