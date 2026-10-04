import type {
  Phase,
  RoadmapGroup,
  Topic,
  UserTopicProgress,
} from "@/generated/prisma/client";

// ─────────────────────────────────────────────
// Auth types
// ─────────────────────────────────────────────

export type UserRole = "USER" | "ADMIN";
export type LearnerRole = "FRONTEND" | "BACKEND" | "BALANCED" | "STARTUP";
export type TargetLevel = "JUNIOR" | "MID" | "SENIOR" | "STAFF";

export type SessionUser = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: UserRole;
};

// ─────────────────────────────────────────────
// Progress types
// ─────────────────────────────────────────────

export type ProgressStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PRACTICED"
  | "COMPLETED"
  | "NEEDS_REVISION";

export type RevisionResult = "EASY" | "GOOD" | "HARD" | "FORGOT";

// ─────────────────────────────────────────────
// Roadmap types (with relations)
// ─────────────────────────────────────────────

export type PhaseWithGroups = Phase & {
  groups: (RoadmapGroup & {
    topics: Topic[];
    _count: { topics: number };
  })[];
  _count: { groups: number };
};

export type TopicWithRelations = Topic & {
  group: RoadmapGroup & { phase: Phase };
  prerequisites: { prerequisiteTopic: Topic }[];
  relationsFrom: { targetTopic: Topic; relationType: string }[];
};

export type TopicWithProgress = Topic & {
  userProgress?: UserTopicProgress | null;
};

export type PhaseCompletionStats = {
  phaseId: string;
  phaseTitle: string;
  phaseOrder: number;
  totalTopics: number;
  completedTopics: number;
  inProgressTopics: number;
  percentage: number;
};

// ─────────────────────────────────────────────
// Dashboard types
// ─────────────────────────────────────────────

export type DashboardStats = {
  totalTopics: number;
  completedTopics: number;
  inProgressTopics: number;
  notStartedTopics: number;
  needsRevisionTopics: number;
  practicedTopics: number;
  completionPercentage: number;
  currentStreak: number;
  longestStreak: number;
  totalLearningMinutes: number;
  activeDays: number;
  weeklyMinutes: number;
};

export type RecentActivity = {
  id: string;
  activityType: string;
  topicTitle?: string;
  topicSlug?: string;
  createdAt: Date;
};

// ─────────────────────────────────────────────
// Analytics types
// ─────────────────────────────────────────────

export type DailyActivity = {
  date: string;
  topicsCompleted: number;
  minutesStudied: number;
};

export type WeeklyActivity = {
  week: string;
  topicsCompleted: number;
  minutesStudied: number;
};

// ─────────────────────────────────────────────
// API response types
// ─────────────────────────────────────────────

export type ApiResponse<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown };

export type PaginatedResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

// ─────────────────────────────────────────────
// Form state types
// ─────────────────────────────────────────────

export type ActionState = {
  error?: string;
  success?: string;
  data?: unknown;
};
