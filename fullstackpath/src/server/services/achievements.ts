import "server-only";

import { prisma } from "@/lib/db/prisma";
import { getActiveDayKeys } from "./activity";
import { calculateStreaks, todayKey } from "@/lib/utils/time";
import { createNotification } from "./notifications";

type CountKey =
  | "topics_completed"
  | "practiced_topics"
  | "phases_completed"
  | "projects_completed"
  | "revisions_completed"
  | "notes_created"
  | "bookmarks_added"
  | "streak_days"
  | "active_days";

type Criteria = {
  type: CountKey;
  threshold: number;
  scope?: "global" | "role";
  roles?: string[];
};

/**
 * Achievement evaluation.
 *
 * Achievements are only ever unlocked from real counts in the user's own
 * database — there is no seeded or demo progress. Evaluation runs after the
 * events that could satisfy a criterion, and is idempotent: the unique index on
 * (userId, achievementId) means re-running it cannot double-unlock.
 */
export async function evaluateAchievements(userId: string): Promise<void> {
  const [user, achievements, unlocked] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { preferredRole: true, targetLevel: true, timezone: true },
    }),
    prisma.achievement.findMany({ select: { id: true, name: true, description: true, criteriaJson: true, icon: true } }),
    prisma.userAchievement.findMany({ where: { userId }, select: { achievementId: true } }),
  ]);

  if (achievements.length === 0) return;

  const already = new Set(unlocked.map((row) => row.achievementId));

  // One pass of counts; individual achievements are then matched against it.
  const counts = await collectCounts(userId, user?.timezone ?? "UTC");
  const eligible = achievements.filter((achievement) => {
    if (already.has(achievement.id)) return false;
    const criteria = achievement.criteriaJson as Criteria;
    if (!criteria?.type) return false;
    if (criteria.scope === "role" && criteria.roles && !criteria.roles.includes(user?.preferredRole ?? "")) {
      return false;
    }
    const value = counts[criteria.type] ?? 0;
    return value >= criteria.threshold;
  });

  if (eligible.length === 0) return;

  await prisma.userAchievement.createMany({
    data: eligible.map((achievement) => ({
      userId,
      achievementId: achievement.id,
    })),
    skipDuplicates: true,
  });

  for (const achievement of eligible) {
    await prisma.learningActivity.create({
      data: {
        userId,
        activityType: "ACHIEVEMENT_UNLOCKED",
        referenceId: achievement.id,
        metadataJson: { achievementName: achievement.name },
      },
    });

    if (user) {
      await createNotification(userId, {
        type: "ACHIEVEMENT",
        title: `Achievement unlocked: ${achievement.name}`,
        body: achievement.description,
        link: "/dashboard",
      });
    }
  }
}

async function collectCounts(userId: string, timezone: string) {
  const [
    topicsCompleted,
    practicedTopics,
    phasesCompleted,
    projectsCompleted,
    revisionsCompleted,
    notesCreated,
    bookmarksAdded,
    activeDayKeys,
  ] = await Promise.all([
    prisma.userTopicProgress.count({ where: { userId, status: "COMPLETED" } }),
    prisma.userTopicProgress.count({ where: { userId, status: { in: ["PRACTICED", "COMPLETED"] } } }),
    countCompletedPhases(userId),
    prisma.userProjectProgress.count({ where: { userId, status: "COMPLETED" } }),
    prisma.revisionHistory.count({ where: { userId } }),
    prisma.userNote.count({ where: { userId } }),
    prisma.bookmark.count({ where: { userId } }),
    getActiveDayKeys(userId, timezone, 400),
  ]);

  const streaks = calculateStreaks(activeDayKeys, todayKey(timezone));

  return {
    topics_completed: topicsCompleted,
    practiced_topics: practicedTopics,
    phases_completed: phasesCompleted,
    projects_completed: projectsCompleted,
    revisions_completed: revisionsCompleted,
    notes_created: notesCreated,
    bookmarks_added: bookmarksAdded,
    streak_days: streaks.longest,
    active_days: streaks.activeDays,
  };
}

/** Phases where every active topic is completed. Archived topics do not count. */
async function countCompletedPhases(userId: string): Promise<number> {
  const phases = await prisma.phase.findMany({
    where: { isActive: true },
    select: {
      id: true,
      groups: {
        where: { isActive: true },
        select: {
          topics: {
            where: { isActive: true },
            select: { userProgress: { where: { userId }, select: { status: true }, take: 1 } },
          },
        },
      },
    },
  });

  let count = 0;
  for (const phase of phases) {
    const topics = phase.groups.flatMap((group) => group.topics);
    if (topics.length === 0) continue;
    const allCompleted = topics.every(
      (topic) => topic.userProgress[0]?.status === "COMPLETED",
    );
    if (allCompleted) count += 1;
  }
  return count;
}
/** Achievements the user has unlocked, most recent first. */
export async function getUnlockedAchievements(userId: string, limit = 20) {
  return prisma.userAchievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: "desc" },
    take: limit,
    select: {
      id: true,
      achievementId: true,
      unlockedAt: true,
      achievement: { select: { name: true, description: true, icon: true } },
    },
  });
}
