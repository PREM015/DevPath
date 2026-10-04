"use client";

import * as React from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Bell, LogOut, Settings, Shield, UserRound, CheckCheck } from "lucide-react";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/feedback";
import { ThemeToggle } from "./theme-toggle";
import { GlobalSearch } from "./global-search";
import { markNotificationsReadAction } from "@/server/actions/notifications";
import type { CurrentUser } from "@/lib/permissions";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: Date | null;
  createdAt: Date;
};

function useOutsideClick<T extends HTMLElement>(onOutside: () => void) {
  const ref = React.useRef<T>(null);
  React.useEffect(() => {
    function handler(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) onOutside();
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onOutside]);
  return ref;
}

export function TopNav({
  user,
  notifications,
}: {
  user: CurrentUser;
  notifications: NotificationItem[];
}) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [bellOpen, setBellOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const closeMenu = React.useCallback(() => setMenuOpen(false), []);
  const menuRef = useOutsideClick<HTMLDivElement>(closeMenu);
  const bellRef = useOutsideClick<HTMLDivElement>(() => setBellOpen(false));

  const unread = notifications.filter((item) => !item.readAt).length;

  function markAllRead() {
    startTransition(async () => {
      await markNotificationsReadAction();
    });
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-3 backdrop-blur-md sm:px-5">
      <GlobalSearch className="w-full max-w-md" />

      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />

        <div ref={bellRef} className="relative">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setBellOpen((open) => !open)}
            aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
            aria-expanded={bellOpen}
          >
            <Bell className="size-4" aria-hidden />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-semibold text-destructive-foreground">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>

          {bellOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-xl border border-border bg-popover shadow-card-hover animate-scale-in">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <p className="text-sm font-semibold">Notifications</p>
                {unread > 0 && (
                  <button
                    onClick={markAllRead}
                    disabled={pending}
                    className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary disabled:opacity-50"
                  >
                    <CheckCheck className="size-3.5" aria-hidden />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                    Nothing yet. Revision reminders and achievements will show up here.
                  </p>
                ) : (
                  <ul className="divide-y divide-border">
                    {notifications.map((item) => {
                      const body = (
                        <div
                          className={cn(
                            "px-4 py-2.5 transition-colors hover:bg-secondary/50",
                            !item.readAt && "bg-primary/[0.04]",
                          )}
                        >
                          <p className="text-sm font-medium leading-snug">{item.title}</p>
                          {item.body && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {item.body}
                            </p>
                          )}
                          <p className="mt-1 text-[11px] text-muted-foreground/70">
                            {formatRelativeTime(item.createdAt)}
                          </p>
                        </div>
                      );

                      return (
                        <li key={item.id}>
                          {item.link ? (
                            <Link
                              href={item.link}
                              onClick={() => setBellOpen(false)}
                              className="block"
                            >
                              {body}
                            </Link>
                          ) : (
                            body
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            className="flex items-center gap-2 rounded-lg px-1.5 py-1 transition-colors hover:bg-secondary"
          >
            <Avatar name={user.name} image={user.image} size="sm" />
            <span className="hidden max-w-[120px] truncate text-sm font-medium sm:block">
              {user.name ?? user.email}
            </span>
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-56 rounded-xl border border-border bg-popover shadow-card-hover animate-scale-in"
            >
              <div className="border-b border-border px-4 py-3">
                <p className="truncate text-sm font-medium">{user.name ?? "Your account"}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <div className="p-1">
                <Link
                  href="/settings"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-secondary"
                >
                  <UserRound className="size-4 text-muted-foreground" aria-hidden />
                  Profile & settings
                </Link>
                <Link
                  href="/settings#security"
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-secondary"
                >
                  <Settings className="size-4 text-muted-foreground" aria-hidden />
                  Account security
                </Link>
                {user.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    role="menuitem"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-secondary"
                  >
                    <Shield className="size-4 text-muted-foreground" aria-hidden />
                    Admin dashboard
                  </Link>
                )}
                <button
                  role="menuitem"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
                >
                  <LogOut className="size-4" aria-hidden />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}