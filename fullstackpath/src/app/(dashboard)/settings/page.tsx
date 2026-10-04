import type { Metadata } from "next";
import { requireUserPage } from "@/lib/permissions";
import { prisma } from "@/lib/db/prisma";
import { SettingsForm } from "@/features/settings/components/settings-form";
import { PageHeader } from "@/components/ui/feedback";
import { DEFAULT_REVISION_INTERVALS } from "@/config";

export const metadata: Metadata = {
  title: "Settings",
  description: "Profile, learning path, study goals, revision settings and account security.",
};

export default async function SettingsPage() {
  const sessionUser = await requireUserPage();

  const account = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      name: true,
      email: true,
      image: true,
      bio: true,
      timezone: true,
      preferredRole: true,
      targetLevel: true,
      dailyGoalMinutes: true,
      weeklyGoalMinutes: true,
      revisionReminders: true,
      dailyGoalReminders: true,
      achievementNotifications: true,
      emailNotifications: true,
      revisionIntervalsJson: true,
      passwordHash: true,
    },
  });

  const intervals = account?.revisionIntervalsJson as number[] | null | undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Settings"
        description="Your profile, what the platform recommends, and what happens to your data."
      />

      <SettingsForm
        profile={{
          name: account?.name ?? null,
          email: account?.email ?? sessionUser.email,
          image: account?.image ?? null,
          bio: account?.bio ?? null,
          timezone: account?.timezone ?? "UTC",
          preferredRole: account?.preferredRole ?? null,
          targetLevel: account?.targetLevel ?? null,
          dailyGoalMinutes: account?.dailyGoalMinutes ?? 60,
          weeklyGoalMinutes: account?.weeklyGoalMinutes ?? 300,
          revisionReminders: account?.revisionReminders ?? true,
          dailyGoalReminders: account?.dailyGoalReminders ?? true,
          achievementNotifications: account?.achievementNotifications ?? true,
          emailNotifications: account?.emailNotifications ?? true,
          revisionIntervals: Array.isArray(intervals) ? intervals : [...DEFAULT_REVISION_INTERVALS],
          usesPassword: Boolean(account?.passwordHash),
        }}
      />
    </div>
  );
}