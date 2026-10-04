import type { Metadata } from "next";
import { requireAdminPage } from "@/lib/permissions";
import { prisma } from "@/lib/db/prisma";
import { setUserRoleAction } from "@/server/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, StatCard } from "@/components/ui/feedback";
import { formatDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "User management",
  robots: { index: false, follow: false },
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const admin = await requireAdminPage();
  const { q } = await searchParams;

  const [users, counts] = await Promise.all([
    prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" } },
              { name: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        preferredRole: true,
        targetLevel: true,
        timezone: true,
        createdAt: true,
        _count: { select: { topicProgress: true, notes: true, studySessions: true } },
      },
    }),
    Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.user.count({ where: { emailVerified: { not: null } } }),
      prisma.user.count({
        where: { topicProgress: { some: { status: "COMPLETED" } } },
      }),
    ]),
  ]);

  const [total, admins, verified, active] = counts;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        title="User management"
        description="Every account on the platform. Role changes take effect on the user's next session refresh."
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value={total} />
        <StatCard label="Administrators" value={admins} tone="warning" />
        <StatCard label="Verified email" value={verified} tone="success" />
        <StatCard label="With completions" value={active} tone="info" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="mb-4 flex gap-2">
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search by name or email…"
              aria-label="Search users"
              className="h-9 w-full max-w-xs rounded-lg border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <button
              type="submit"
              className="h-9 rounded-lg border border-border px-3 text-sm hover:bg-secondary"
            >
              Search
            </button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="pb-2 font-medium">Account</th>
                  <th className="pb-2 font-medium">Role</th>
                  <th className="pb-2 font-medium">Path</th>
                  <th className="pb-2 font-medium">Progress</th>
                  <th className="pb-2 font-medium">Joined</th>
                  <th className="pb-2 font-medium">Change role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map((user) => (
                  <tr key={user.id}>
                    <td className="py-2.5">
                      <div className="font-medium">{user.name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                      {!user.emailVerified && (
                        <Badge variant="warning" className="mt-1">
                          unverified
                        </Badge>
                      )}
                    </td>
                    <td className="py-2.5">
                      <Badge variant={user.role === "ADMIN" ? "warning" : "outline"}>{user.role}</Badge>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">
                      {user.preferredRole ?? "—"} / {user.targetLevel ?? "—"}
                      <div className="text-[11px]">{user.timezone}</div>
                    </td>
                    <td className="py-2.5 text-xs tabular-nums text-muted-foreground">
                      {user._count.topicProgress} topics · {user._count.studySessions} sessions
                      <div className="text-[11px]">{user._count.notes} notes</div>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">{formatDate(user.createdAt)}</td>
                    <td className="py-2.5">
                      {user.id === admin.id ? (
                        <span className="text-xs text-muted-foreground">That is you</span>
                      ) : (
                        <form
                          action={async (formData) => {
                            "use server";
                            await setUserRoleAction({
                              userId: user.id,
                              role: String(formData.get("role")) as "USER" | "ADMIN",
                            });
                          }}
                        >
                          <select
                            name="role"
                            defaultValue={user.role}
                            aria-label={`Role for ${user.email}`}
                            className="h-8 rounded-lg border border-input bg-background px-2 text-xs"
                          >
                            <option value="USER">USER</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>
                          <button
                            type="submit"
                            className="ml-1.5 h-8 rounded-lg border border-border px-2 text-xs hover:bg-secondary"
                          >
                            Save
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No users match.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}