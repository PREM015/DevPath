import {
  CONTENT_TOTALS,
  PHASE_1_OUTLINE,
  PHASE_2_OUTLINE,
  PHASE_3_OUTLINE,
  PHASE_4_OUTLINE,
  PHASE_5_OUTLINE,
  PHASE_6_OUTLINE,
  PHASE_7_OUTLINE,
  PHASE_8_OUTLINE,
  PHASE_9_OUTLINE,
  PHASE_10_OUTLINE,
  PHASE_11_OUTLINE,
  PHASE_12_OUTLINE,
  PHASE_13_OUTLINE,
  PHASE_14_OUTLINE,
  PHASE_15_OUTLINE,
} from "@/content/phase-outlines";

export type PhaseOutlineEntry = {
  order: number;
  title: string;
  icon: string;
  color: string;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED" | "SENIOR";
  summary: string;
  topics: number;
  groups: string[];
  /** Topics whose body content was recovered, not just the outline title. */
  deepTopics: number;
  questions: number;
  answeredQuestions: number;
  practiceBlocks: number;
  practiceItems: number;
};

const ALL: PhaseOutlineEntry[] = [
  PHASE_1_OUTLINE,
  PHASE_2_OUTLINE,
  PHASE_3_OUTLINE,
  PHASE_4_OUTLINE,
  PHASE_5_OUTLINE,
  PHASE_6_OUTLINE,
  PHASE_7_OUTLINE,
  PHASE_8_OUTLINE,
  PHASE_9_OUTLINE,
  PHASE_10_OUTLINE,
  PHASE_11_OUTLINE,
  PHASE_12_OUTLINE,
  PHASE_13_OUTLINE,
  PHASE_14_OUTLINE,
  PHASE_15_OUTLINE,
].sort((a, b) => a.order - b.order);

export { CONTENT_TOTALS };

export const PHASE_OUTLINE = {
  phases: ALL,
  totalGroups: ALL.reduce((sum, phase) => sum + phase.groups.length, 0),
  totalTopics: ALL.reduce((sum, phase) => sum + phase.topics, 0),
  /**
   * Phases with no authored body yet. The outline lists their topic titles, so
   * the roadmap can show them, but there is nothing to study or drill. The UI
   * labels these rather than letting an empty phase look finished.
   */
  outlineOnlyPhases: ALL.filter((phase) => phase.deepTopics === 0).map((phase) => phase.order),
};