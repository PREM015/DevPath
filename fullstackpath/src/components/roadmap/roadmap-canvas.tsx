"use client";

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Lock,
  Layers,
  Map as MapIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TopicPanel } from "./topic-panel";
import type {
  CanvasStatus,
  GroupNodeData,
  GroupTopicsPayload,
  PhaseNodeData,
  PhasePayload,
  TopicNodeData,
  TopicPanelData,
} from "./types";

// ─────────────────────────────────────────────
// Node components
// ─────────────────────────────────────────────

const STATUS_STYLES: Record<CanvasStatus, { ring: string; badge: string; label: string }> = {
  NOT_STARTED: {
    ring: "border-border bg-card",
    badge: "text-muted-foreground",
    label: "Not started",
  },
  IN_PROGRESS: {
    ring: "border-blue-500/50 bg-blue-500/[0.07]",
    badge: "text-blue-600 dark:text-blue-400",
    label: "In progress",
  },
  PRACTICED: {
    ring: "border-cyan-500/50 bg-cyan-500/[0.07]",
    badge: "text-cyan-600 dark:text-cyan-400",
    label: "Practiced",
  },
  COMPLETED: {
    ring: "border-green-500/50 bg-green-500/[0.07]",
    badge: "text-green-600 dark:text-green-400",
    label: "Completed",
  },
  NEEDS_REVISION: {
    ring: "border-orange-500/50 bg-orange-500/[0.07]",
    badge: "text-orange-600 dark:text-orange-400",
    label: "Needs revision",
  },
};

const DIFFICULTY_DOT: Record<string, string> = {
  BEGINNER: "bg-green-500",
  INTERMEDIATE: "bg-yellow-500",
  ADVANCED: "bg-red-500",
  SENIOR: "bg-purple-500",
};

function DifficultyDot({ difficulty }: { difficulty: string }) {
  return (
    <span
      aria-hidden
      title={difficulty}
      className={cn("size-1.5 shrink-0 rounded-full", DIFFICULTY_DOT[difficulty] ?? "bg-muted-foreground")}
    />
  );
}

function PhaseCard({ data, selected }: NodeProps & { data: PhaseNodeData }) {
  return (
    <div
      className={cn(
        "w-72 rounded-xl border bg-card p-4 shadow-card transition-all",
        data.expanded ? "border-primary/60" : "border-border",
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <div className="flex items-start gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-base"
          style={{ backgroundColor: `${data.color}22` }}
          aria-hidden
        >
          {data.icon ?? "📘"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Phase {data.order}
          </p>
          <p className="truncate text-sm font-semibold leading-tight">{data.title}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {data.groupCount} groups · {data.topicCount} topics
          </p>
        </div>
        <span className="shrink-0 text-muted-foreground" aria-hidden>
          {data.loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : data.expanded ? (
            <ChevronDown className="size-4" />
          ) : (
            <ChevronRight className="size-4" />
          )}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{
              width: `${data.percentage}%`,
              backgroundColor: data.color,
            }}
          />
        </div>
        <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
          {data.completedCount}/{data.topicCount}
        </span>
      </div>
    </div>
  );
}

function GroupCard({ data }: NodeProps & { data: GroupNodeData }) {
  return (
    <div
      className={cn(
        "w-52 rounded-lg border bg-secondary/40 p-3 shadow-sm transition-all",
        data.expanded ? "border-primary/40" : "border-border",
      )}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <div className="flex items-center gap-2">
        <DifficultyDot difficulty={data.difficulty} />
        <p className="min-w-0 flex-1 truncate text-xs font-semibold">{data.title}</p>
        <span className="shrink-0 text-muted-foreground" aria-hidden>
          {data.loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : data.expanded ? (
            <ChevronDown className="size-3.5" />
          ) : (
            <ChevronRight className="size-3.5" />
          )}
        </span>
      </div>

      <p className="mt-1.5 text-[10px] text-muted-foreground">
        {data.completedCount}/{data.totalCount} complete
      </p>
    </div>
  );
}

function TopicCard({ data, selected }: NodeProps & { data: TopicNodeData }) {
  const style = STATUS_STYLES[data.status];

  return (
    <div
      role="button"
      tabIndex={-1}
      className={cn(
        "w-56 cursor-pointer rounded-lg border p-2.5 shadow-sm transition-all hover:shadow-card",
        style.ring,
        selected && "ring-2 ring-primary ring-offset-2 ring-offset-background",
      )}
    >
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />

      <div className="flex items-start gap-1.5">
        {data.status === "COMPLETED" ? (
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-green-500" aria-hidden />
        ) : data.blocked ? (
          <Lock className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/60" aria-hidden />
        ) : (
          <DifficultyDot difficulty={data.difficulty} />
        )}
        <p className="line-clamp-2 flex-1 text-[11px] font-medium leading-snug">{data.title}</p>
      </div>

      <div className="mt-1.5 flex items-center gap-1.5">
        <span className={cn("text-[9px] font-medium uppercase tracking-wide", style.badge)}>
          {style.label}
        </span>
        {data.bookmarked && <span className="text-[9px] text-muted-foreground" aria-label="Bookmarked">★</span>}
      </div>
    </div>
  );
}

const NODE_TYPES = {
  phase: PhaseCard,
  group: GroupCard,
  topic: TopicCard,
};

// ─────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────

const PHASE_WIDTH = 288;
const GROUP_WIDTH = 208;
const TOPIC_WIDTH = 224;
const ROW_GAP = 96;
const GROUP_GAP = 240;
const BLOCK_GAP = 72;

/**
 * Column-major layout: every level flows top-to-bottom, siblings sit side by side.
 * Only expanded branches contribute children, so the canvas height tracks what is
 * actually open rather than the size of the whole roadmap.
 */
function layout(
  phases: PhaseNodeData[],
  expandedPhases: Set<string>,
  groupIndexByPhase: Map<string, { node: GroupNodeData; topics: TopicNodeData[] }[]>,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  let row = 0;

  for (const phase of phases) {
    positions.set(`phase:${phase.id}`, { x: 0, y: row * ROW_GAP });
    row += 1;

    const children = groupIndexByPhase.get(phase.id) ?? [];
    if (!expandedPhases.has(phase.id) || children.length === 0) continue;

    let maxChildRows = 0;

    children.forEach((entry, column) => {
      const group = entry.node;
      positions.set(`group:${group.id}`, {
        x: PHASE_WIDTH + BLOCK_GAP + column * GROUP_GAP,
        y: row * ROW_GAP,
      });
      let childRows = 1;

      if (group.expanded && entry.topics.length > 0) {
        entry.topics.forEach((topic, topicIndex) => {
          positions.set(`topic:${topic.id}`, {
            x: PHASE_WIDTH + BLOCK_GAP + column * GROUP_GAP + TOPIC_WIDTH - GROUP_WIDTH + 16,
            y: (row + 1 + topicIndex) * ROW_GAP,
          });
        });
        childRows = 1 + entry.topics.length;
      }

      maxChildRows = Math.max(maxChildRows, childRows);
    });

    row += Math.max(1, maxChildRows) + 1;
  }

  return positions;
}

// ─────────────────────────────────────────────
// Canvas
// ─────────────────────────────────────────────

type FilterState = {
  query: string;
  difficulty: string;
  status: string;
  showArchived: boolean;
};

const EMPTY_FILTERS: FilterState = { query: "", difficulty: "", status: "", showArchived: false };

function RoadmapCanvasInner({
  initialPhases,
}: {
  initialPhases: PhaseNodeData[];
}) {
  const router = useRouter();

  const [phases, setPhases] = React.useState(initialPhases);
  const [expandedPhases, setExpandedPhases] = React.useState<Set<string>>(new Set());
  const [groupIndex, setGroupIndex] = React.useState<
    Map<string, { node: GroupNodeData; topics: TopicNodeData[] }[]>
  >(new Map());
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
  const [bookmarks, setBookmarks] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState<Record<string, boolean>>({});
  const [selectedNode, setSelectedNode] = React.useState<string | null>(null);
  const [panelData, setPanelData] = React.useState<TopicPanelData | null>(null);
  const [filters, setFilters] = React.useState<FilterState>(EMPTY_FILTERS);
  const [showFilters, setShowFilters] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<"graph" | "list">("graph");

  // ── Derived graph ─────────────────────────────────────────────
  const phaseById = React.useMemo(
    () => new Map(phases.map((phase) => [phase.id, phase])),
    [phases],
  );

  const allTopics = React.useMemo(() => {
    const list: TopicNodeData[] = [];
    for (const entries of groupIndex.values()) {
      list.push(...entries.flatMap((entry) => entry.topics));
    }
    return list;
  }, [groupIndex]);

  const topicById = React.useMemo(() => new Map(allTopics.map((t) => [t.id, t])), [allTopics]);

  /** Topics with at least one unmet prerequisite among loaded topics. */
  const blockedIds = React.useMemo(() => {
    const blocked = new Set<string>();
    for (const topic of allTopics) {
      const unmet = (topic.blockedBy ?? []).filter((id) => {
        const prerequisite = topicById.get(id);
        return prerequisite ? prerequisite.status !== "COMPLETED" : false;
      });
      if (unmet.length > 0) blocked.add(topic.id);
    }
    return blocked;
  }, [allTopics, topicById]);

  const visibleTopics = React.useMemo(() => {
    return allTopics.filter((topic) => {
      if (filters.query && !topic.title.toLowerCase().includes(filters.query.toLowerCase())) {
        return false;
      }
      if (filters.difficulty && topic.difficulty !== filters.difficulty) return false;
      if (filters.status && topic.status !== filters.status) return false;
      return true;
    });
  }, [allTopics, filters]);

  const visibleTopicIds = React.useMemo(
    () => new Set(visibleTopics.map((topic) => topic.id)),
    [visibleTopics],
  );

  const nodes = React.useMemo(() => {
    const positions = layout(phases, expandedPhases, groupIndex);
    const result: Node[] = [];

    const matchesFilters = (node: { title: string; difficulty: string }) =>
      (!filters.query || node.title.toLowerCase().includes(filters.query.toLowerCase())) &&
      (!filters.difficulty || node.difficulty === filters.difficulty);

    for (const phase of phases) {
      const position = positions.get(`phase:${phase.id}`);
      if (!position) continue;
      result.push({
        id: `phase:${phase.id}`,
        type: "phase",
        position,
        data: { ...phase, loading: Boolean(loading[`phase:${phase.id}`]) },
        selected: selectedNode === `phase:${phase.id}`,
      } satisfies Node);
    }

    for (const phaseId of expandedPhases) {
      const entries = groupIndex.get(phaseId) ?? [];
      for (const entry of entries) {
        if (!matchesFilters(entry.node) && !entry.topics.some((topic) => visibleTopicIds.has(topic.id))) {
          continue;
        }
        const position = positions.get(`group:${entry.node.id}`);
        if (!position) continue;
        result.push({
          id: `group:${entry.node.id}`,
          type: "group",
          position,
          data: {
            ...entry.node,
            loading: Boolean(loading[`group:${entry.node.id}`]),
          },
          selected: selectedNode === `group:${entry.node.id}`,
        } satisfies Node);
      }
    }

    for (const phaseId of expandedPhases) {
      for (const entry of groupIndex.get(phaseId) ?? []) {
        if (!expandedGroups.has(entry.node.id)) continue;
        for (const topic of entry.topics) {
          if (!visibleTopicIds.has(topic.id)) continue;
          const position = positions.get(`topic:${topic.id}`);
          if (!position) continue;
          result.push({
            id: `topic:${topic.id}`,
            type: "topic",
            position,
            data: {
              ...topic,
              blocked: blockedIds.has(topic.id),
              bookmarked: bookmarks.has(topic.id),
            },
            selected: selectedNode === `topic:${topic.id}`,
          } satisfies Node);
        }
      }
    }

    return result;
  }, [
    phases,
    groupIndex,
    expandedPhases,
    expandedGroups,
    visibleTopicIds,
    blockedIds,
    bookmarks,
    loading,
    filters,
    selectedNode,
  ]);

  const edges = React.useMemo(() => {
    const result: Edge[] = [];

    // Phase chain.
    phases.forEach((phase, index) => {
      if (index === 0) return;
      const previous = phases[index - 1]!;
      result.push({
        id: `phase-chain-${previous.id}-${phase.id}`,
        source: `phase:${previous.id}`,
        target: `phase:${phase.id}`,
        type: "smoothstep",
        style: { strokeWidth: 1.5 },
      });
    });

    // Phase -> group.
    for (const phaseId of expandedPhases) {
      const entries = groupIndex.get(phaseId) ?? [];
      entries.forEach((entry) => {
        result.push({
          id: `phase-group-${phaseId}-${entry.node.id}`,
          source: `phase:${phaseId}`,
          target: `group:${entry.node.id}`,
          type: "smoothstep",
          style: { strokeWidth: 1 },
        });
      });
    }

    // Prerequisite links inside expanded groups, met vs unmet.
    for (const phaseId of expandedPhases) {
      for (const entry of groupIndex.get(phaseId) ?? []) {
        if (!expandedGroups.has(entry.node.id)) continue;
        for (const topic of entry.topics) {
          if (!visibleTopicIds.has(topic.id)) continue;
          for (const prerequisiteId of topic.blockedBy ?? []) {
            const prerequisite = topicById.get(prerequisiteId);
            if (!prerequisite || !visibleTopicIds.has(prerequisiteId)) continue;
            const met = prerequisite.status === "COMPLETED";
            result.push({
              id: `prereq-${topic.id}-${prerequisiteId}`,
              source: `topic:${topic.id}`,
              target: `topic:${prerequisiteId}`,
              type: "smoothstep",
              animated: !met,
              style: {
                strokeWidth: met ? 1.5 : 1,
                strokeDasharray: met ? undefined : "4 3",
              },
            });
          }
        }
      }
    }

    return result;
  }, [phases, groupIndex, expandedPhases, expandedGroups, visibleTopicIds, topicById]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<Node>([]);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>([]);

  React.useEffect(() => setFlowNodes(nodes), [nodes, setFlowNodes]);
  React.useEffect(() => setFlowEdges(edges), [edges, setFlowEdges]);

  // ── Data loading ──────────────────────────────────────────────
  const togglePhase = React.useCallback(
    async (phaseId: string) => {
      setSelectedNode(null);
      setPanelData(null);

      if (expandedPhases.has(phaseId)) {
        setExpandedPhases((current) => {
          const next = new Set(current);
          next.delete(phaseId);
          return next;
        });
        return;
      }

      if (!groupIndex.has(phaseId)) {
        setLoading((current) => ({ ...current, [`phase:${phaseId}`]: true }));
        try {
          const response = await fetch(`/api/roadmap/phases/${phaseId}`);
          if (!response.ok) return;
          const payload = (await response.json()) as PhasePayload;

          setPhases((current) =>
            current.map((phase) =>
              phase.id === phaseId
                ? {
                    ...phase,
                    groupCount: payload.groups.length,
                    topicCount: payload.groups.reduce((sum, group) => sum + group.totalCount, 0),
                    completedCount: payload.groups.reduce(
                      (sum, group) => sum + group.completedCount,
                      0,
                    ),
                  }
                : phase,
            ),
          );

          setGroupIndex((current) => {
            const next = new Map(current);
            next.set(
              phaseId,
              payload.groups.map((group) => ({
                node: {
                  id: group.id,
                  phaseId,
                  title: group.title,
                  difficulty: group.difficulty,
                  totalCount: group.totalCount,
                  completedCount: group.completedCount,
                  expanded: false,
                  loading: false,
                },
                topics: [],
              })),
            );
            return next;
          });
        } finally {
          setLoading((current) => {
            const next = { ...current };
            delete next[`phase:${phaseId}`];
            return next;
          });
        }
      }

      setExpandedPhases((current) => new Set(current).add(phaseId));
    },
    [expandedPhases, groupIndex],
  );

  const toggleGroup = React.useCallback(
    async (phaseId: string, groupId: string) => {
      setSelectedNode(null);
      setPanelData(null);

      if (expandedGroups.has(groupId)) {
        setExpandedGroups((current) => {
          const next = new Set(current);
          next.delete(groupId);
          return next;
        });
        return;
      }

      const hasTopics = (groupIndex.get(phaseId) ?? []).find(
        (entry) => entry.node.id === groupId,
      )?.topics.length;

      if (!hasTopics) {
        setLoading((current) => ({ ...current, [`group:${groupId}`]: true }));
        try {
          const response = await fetch(`/api/roadmap/groups/${groupId}/topics`);
          if (!response.ok) return;
          const payload = (await response.json()) as GroupTopicsPayload;

          const prerequisiteById = new Map(
            payload.prerequisites.map((prerequisite) => [prerequisite.id, prerequisite]),
          );

          setGroupIndex((current) => {
            const next = new Map(current);
            const entries = next.get(phaseId) ?? [];
            next.set(
              phaseId,
              entries.map((entry) =>
                entry.node.id === groupId
                  ? {
                      node: { ...entry.node, expanded: true, loading: false },
                      topics: payload.topics.map((topic) => ({
                        id: topic.id,
                        slug: topic.slug,
                        title: topic.title,
                        difficulty: topic.difficulty,
                        estimatedMinutes: topic.estimatedMinutes,
                        status: topic.status,
                        groupId,
                        phaseId,
                        blocked: false,
                        bookmarked: false,
                        blockedBy: topic.prerequisiteIds.filter(
                          (id) => prerequisiteById.has(id),
                        ),
                      })),
                    }
                  : entry,
              ),
            );
            return next;
          });
        } finally {
          setLoading((current) => {
            const next = { ...current };
            delete next[`group:${groupId}`];
            return next;
          });
        }
      } else {
        setGroupIndex((current) => {
          const next = new Map(current);
          next.set(
            phaseId,
            (next.get(phaseId) ?? []).map((entry) =>
              entry.node.id === groupId
                ? { ...entry, node: { ...entry.node, expanded: true } }
                : entry,
            ),
          );
          return next;
        });
      }

      setExpandedGroups((current) => new Set(current).add(groupId));
    },
    [expandedGroups, groupIndex],
  );

  const openTopic = React.useCallback(
    async (topicId: string) => {
      const topic = topicById.get(topicId);
      if (!topic) return;

      setSelectedNode(`topic:${topicId}`);
      setPanelData(null);

      const response = await fetch(`/api/roadmap/topics/${topic.slug}`);
      if (!response.ok) {
        setSelectedNode(null);
        return;
      }
      const payload = (await response.json()) as TopicPanelData;
      setPanelData(payload);
      setBookmarks((current) => {
        const next = new Set(current);
        if (payload.bookmarked) next.add(payload.id);
        else next.delete(payload.id);
        return next;
      });
    },
    [topicById],
  );

  function onNodeClick(_: React.MouseEvent, node: Node) {
    if (node.type === "phase") {
      void togglePhase(node.id.replace("phase:", ""));
    } else if (node.type === "group") {
      const groupId = node.id.replace("group:", "");
      const phaseId = findPhaseForGroup(groupId);
      if (phaseId) void toggleGroup(phaseId, groupId);
    } else if (node.type === "topic") {
      void openTopic(node.id.replace("topic:", ""));
    }
  }

  const findPhaseForGroup = React.useCallback(
    (groupId: string) => {
      for (const [phaseId, entries] of groupIndex) {
        if (entries.some((entry) => entry.node.id === groupId)) return phaseId;
      }
      return null;
    },
    [groupIndex],
  );

  function onStatusChange(topicId: string, status: string) {
    setGroupIndex((current) => {
      const next = new Map(current);
      for (const [phaseId, entries] of current) {
        next.set(
          phaseId,
          entries.map((entry) => ({
            ...entry,
            topics: entry.topics.map((topic) =>
              topic.id === topicId ? { ...topic, status: status as CanvasStatus } : topic,
            ),
          })),
        );
      }
      return next;
    });
  }

  function onBookmarkChange(topicId: string, bookmarked: boolean) {
    setBookmarks((current) => {
      const next = new Set(current);
      if (bookmarked) next.add(topicId);
      else next.delete(topicId);
      return next;
    });
  }

  // ── List view (mobile-friendly) ───────────────────────────────
  const listView = React.useMemo(() => {
    return phases.map((phase) => {
      const entries = groupIndex.get(phase.id) ?? [];
      const topicRows = entries.flatMap((entry) =>
        entry.topics.filter((topic) => visibleTopicIds.has(topic.id)),
      );
      return { phase, groups: entries, topics: topicRows };
    });
  }, [phases, groupIndex, visibleTopicIds]);

  const activeFilterCount =
    (filters.query ? 1 : 0) + (filters.difficulty ? 1 : 0) + (filters.status ? 1 : 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <input
            type="search"
            value={filters.query}
            onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
            placeholder="Filter loaded topics…"
            aria-label="Filter topics by name"
            className="h-8 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>

        <select
          value={filters.difficulty}
          onChange={(event) => setFilters((current) => ({ ...current, difficulty: event.target.value }))}
          aria-label="Filter by difficulty"
          className="h-8 rounded-lg border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All difficulties</option>
          <option value="BEGINNER">Beginner</option>
          <option value="INTERMEDIATE">Intermediate</option>
          <option value="ADVANCED">Advanced</option>
          <option value="SENIOR">Senior</option>
        </select>

        <select
          value={filters.status}
          onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
          aria-label="Filter by status"
          className="h-8 rounded-lg border border-border bg-background px-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">All statuses</option>
          <option value="NOT_STARTED">Not started</option>
          <option value="IN_PROGRESS">In progress</option>
          <option value="PRACTICED">Practiced</option>
          <option value="COMPLETED">Completed</option>
          <option value="NEEDS_REVISION">Needs revision</option>
        </select>

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters(EMPTY_FILTERS)}
          disabled={activeFilterCount === 0}
        >
          Clear{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
        </Button>

        <div className="ml-auto flex items-center gap-1 rounded-lg border border-border p-0.5">
          <button
            onClick={() => setViewMode("graph")}
            aria-pressed={viewMode === "graph"}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              viewMode === "graph" ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            <MapIcon className="size-3.5" aria-hidden />
            Graph
          </button>
          <button
            onClick={() => setViewMode("list")}
            aria-pressed={viewMode === "list"}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              viewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground",
            )}
          >
            <Layers className="size-3.5" aria-hidden />
            List
          </button>
        </div>
      </div>

      {viewMode === "graph" ? (
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-border">
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onNodeClick}
            onPaneClick={() => {
              setSelectedNode(null);
              setPanelData(null);
            }}
            nodeTypes={NODE_TYPES}
            minZoom={0.15}
            maxZoom={1.6}
            defaultEdgeOptions={{ type: "smoothstep" }}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            fitView
            fitViewOptions={{ padding: 0.15 }}
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1.25} />
            <Controls showInteractive={false} position="bottom-left" />
            <MiniMap
              pannable
              zoomable
              position="bottom-right"
              nodeColor={(node) =>
                node.type === "phase"
                  ? (phaseById.get(node.id.replace("phase:", ""))?.color ?? "#6366f1")
                  : node.type === "group"
                    ? "hsl(var(--muted-foreground))"
                    : (STATUS_STYLES[(node.data as TopicNodeData).status]?.ring.includes("green")
                        ? "#22c55e"
                        : "hsl(var(--card))")
              }
              maskColor="hsl(var(--background) / 0.7)"
            />

            <Panel position="top-left" className="!m-3">
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card/90 px-3 py-2 text-[11px] backdrop-blur">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-green-500" aria-hidden /> Completed
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-blue-500" aria-hidden /> In progress
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-cyan-500" aria-hidden /> Practiced
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-orange-500" aria-hidden /> Needs revision
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="size-3" aria-hidden /> Unmet prerequisite
                </span>
              </div>
            </Panel>

            {showFilters && (
              <Panel position="top-right" className="!m-3">
                <button
                  onClick={() => setShowFilters(false)}
                  className="rounded-lg border border-border bg-card/90 px-3 py-2 text-xs backdrop-blur"
                >
                  Hide legend
                </button>
              </Panel>
            )}
          </ReactFlow>

          {/* Topic side panel */}
          {panelData && (
            <aside
              className="absolute inset-y-0 right-0 z-20 flex w-full max-w-sm animate-slide-in-right flex-col border-l border-border bg-popover shadow-card-hover"
              aria-label="Topic details"
            >
              <button
                onClick={() => {
                  setPanelData(null);
                  setSelectedNode(null);
                }}
                className="absolute right-3 top-3 z-10 rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Close topic panel"
              >
                <svg viewBox="0 0 20 20" className="size-4" aria-hidden>
                  <path
                    d="M5 5l10 10M15 5L5 15"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    fill="none"
                  />
                </svg>
              </button>
              <TopicPanel
                data={panelData}
                onStatusChange={onStatusChange}
                onBookmarkChange={onBookmarkChange}
              />
            </aside>
          )}
        </div>
      ) : (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border p-3">
          {listView.map(({ phase, groups }) => {
            const isOpen = expandedPhases.has(phase.id);
            return (
              <section key={phase.id} className="rounded-lg border border-border">
                <button
                  onClick={() => void togglePhase(phase.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 p-3 text-left"
                >
                  <span aria-hidden>{phase.icon ?? "📘"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">
                      {phase.order}. {phase.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {phase.completedCount}/{phase.topicCount} complete
                    </span>
                  </span>
                  {isOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </button>

                {isOpen && (
                  <div className="space-y-2 border-t border-border p-3">
                    {groups.map((entry) => (
                      <div key={entry.node.id} className="rounded-md border border-border/70">
                        <button
                          onClick={() => void toggleGroup(phase.id, entry.node.id)}
                          aria-expanded={expandedGroups.has(entry.node.id)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left"
                        >
                          <DifficultyDot difficulty={entry.node.difficulty} />
                          <span className="flex-1 truncate text-xs font-medium">{entry.node.title}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {entry.node.completedCount}/{entry.node.totalCount}
                          </span>
                        </button>

                        {expandedGroups.has(entry.node.id) && (
                          <ul className="space-y-1 border-t border-border/70 p-2">
                            {entry.topics
                              .filter((topic) => visibleTopicIds.has(topic.id))
                              .map((topic) => (
                                <li key={topic.id}>
                                  <button
                                    onClick={() => router.push(`/roadmap/${topic.slug}`)}
                                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-secondary"
                                  >
                                    {topic.status === "COMPLETED" ? (
                                      <CheckCircle2 className="size-3.5 shrink-0 text-green-500" aria-hidden />
                                    ) : (
                                      <DifficultyDot difficulty={topic.difficulty} />
                                    )}
                                    <span className="flex-1 truncate">{topic.title}</span>
                                    <span className="shrink-0 text-[10px] text-muted-foreground">
                                      {topic.status.replace(/_/g, " ").toLowerCase()}
                                    </span>
                                  </button>
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>
                    ))}
                    {groups.length === 0 && (
                      <p className="text-xs text-muted-foreground">Loading groups…</p>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function RoadmapCanvas(props: {
  initialPhases: PhaseNodeData[];
}) {
  return (
    <ReactFlowProvider>
      <RoadmapCanvasInner {...props} />
    </ReactFlowProvider>
  );
}