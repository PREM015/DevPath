import { redirect } from "next/navigation";
import { requireUserPage } from "@/lib/permissions";
import { Sidebar } from "@/components/layout/sidebar";
import { SidebarProvider } from "@/components/layout/sidebar-context";
import { TopNav, type NotificationItem } from "@/components/layout/top-nav";
import { MobileNav } from "@/components/layout/mobile-nav";
import { TooltipProvider } from "@/components/ui/primitives";
import { getNotifications, syncRevisionNotifications } from "@/server/services/notifications";

/**
 * Authenticated application shell.
 *
 * The session is checked here for early redirects, and again — independently —
 * inside every service and server action the pages use. The layout check is a
 * convenience, not the authorization boundary.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sessionUser = await requireUserPage();
  const isAdmin = sessionUser.role === "ADMIN";

  // Creates revision-due notifications from real due dates. Idempotent.
  await syncRevisionNotifications(sessionUser.id).catch(() => undefined);

  const notifications: NotificationItem[] = await getNotifications(sessionUser.id, 15)
    .then((result) =>
      result.items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        link: item.link,
        readAt: item.readAt,
        createdAt: item.createdAt.toISOString() as unknown as Date,
      })),
    )
    .catch(() => []);

  return (
    <SidebarProvider>
      <TooltipProvider delayDuration={200}>
        <div className="flex h-dvh overflow-hidden bg-background">
          <Sidebar isAdmin={isAdmin} />

          <div className="flex min-w-0 flex-1 flex-col">
            <TopNav user={sessionUser} notifications={notifications} />
            <main
              id="main-content"
              className="flex-1 overflow-y-auto px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-8"
            >
              {children}
            </main>
          </div>

          <MobileNav />
        </div>
      </TooltipProvider>
    </SidebarProvider>
  );
}

export function redirectToLogin(): never {
  redirect("/login");
}