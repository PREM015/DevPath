export type CanvasStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "PRACTICED"
  | "COMPLETED"
  | "NEEDS_REVISION";

export type PhaseNodeData = {
  id: string;
  slug: string;
  title: string;
  order: number;
  color: string;
  icon: string | null;
  difficulty: string;
  estimatedHours: number | null;
  topicCount: number;
  groupCount: number;
  completedCount: number;
  percentage: number;
  expanded: boolean;
  loading: boolean;
};

export type GroupNodeData = {
  id: string;
  phaseId: string;
  title: string;
  difficulty: string;
  totalCount: number;
  completedCount: number;
  expanded: boolean;
  loading: boolean;
};

export type TopicNodeData = {
  id: string;
  slug: string;
  title: string;
  difficulty: string;
  estimatedMinutes: number;
  status: CanvasStatus;
  groupId: string;
  phaseId: string;
  blocked: boolean;
  bookmarked: boolean;
  /** Ids of this topic's prerequisites that are present in the loaded graph. */
  blockedBy?: string[];
};

export type TopicPanelData = {
  id: string;
  slug: string;
  title: string;
  description: string;
  difficulty: string;
  estimatedMinutes: number;
  isArchived: boolean;
  keyConcepts: string[];
  group: { id: string; title: string; phase: { title: string; order: number } };
  status: CanvasStatus;
  completedAt: string | null;
  totalTimeMinutes: number;
  bookmarked: boolean;
  scheduledForRevision: boolean;
  prerequisitesMet: number;
  prerequisitesTotal: number;
};

export type PhasePayload = {
  phase: {
    id: string;
    title: string;
    description: string;
    order: number;
    color: string;
    icon: string | null;
    difficulty: string;
    estimatedHours: number | null;
    objectives: string[];
  };
  groups: {
    id: string;
    title: string;
    description: string;
    order: number;
    difficulty: string;
    estimatedHours: number | null;
    objectives: string[];
    topicCount: number;
    totalCount: number;
    completedCount: number;
  }[];
};

export type GroupTopicsPayload = {
  group: {
    id: string;
    title: string;
    description: string;
    difficulty: string;
    estimatedHours: number | null;
    objectives: string[];
    phase: { id: string; title: string; order: number; color: string };
  };
  topics: {
    id: string;
    slug: string;
    title: string;
    difficulty: string;
    estimatedMinutes: number;
    status: CanvasStatus;
    prerequisiteIds: string[];
  }[];
  prerequisites: {
    id: string;
    slug: string;
    title: string;
    isArchived: boolean;
    status: CanvasStatus;
  }[];
  edges: { id: string; from: string; to: string; met: boolean }[];
};