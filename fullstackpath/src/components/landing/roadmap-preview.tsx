"use client";

import * as React from "react";
import Link from "next/link";
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
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { ChevronRight } from "lucide-react";
import { PHASE_OUTLINE } from "@/features/roadmap/phase-outline-data";
import { PHASE_1_OUTLINE } from "@/content/phase-outlines";

const PHASE_WIDTH = 260;
const ROW_GAP = 84;
const GROUP_GAP = 214;

function PreviewPhaseNode({ data }: { data: { phase: (typeof PHASE_OUTLINE.phases)[number] } }) {
  const phase = data.phase;
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 shadow-card">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-start gap-2.5">
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-sm"
          style={{ backgroundColor: `${phase.color}22` }}
          aria-hidden
        >
          {phase.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            Phase {phase.order}
          </p>
          <p className="truncate text-xs font-semibold leading-tight">{phase.title}</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">
            {phase.groups.length} groups · {phase.topics} topics
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function PreviewGroupNode({ data }: { data: { title: string; color: string; count: number } }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/40 p-2.5 shadow-sm">
      <Handle type="target" position={Position.Top} />
      <div className="flex items-center gap-1.5">
        <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: data.color }} aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[10px] font-semibold">{data.title}</p>
        <span className="shrink-0 text-[9px] text-muted-foreground">{data.count}</span>
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function PreviewTopicNode({ data }: { data: { label: string } }) {
  return (
    <div className="w-40 rounded-md border border-border bg-card p-2 shadow-sm">
      <Handle type="target" position={Position.Top} />
      <p className="truncate text-[10px]">{data.label}</p>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

const NODE_TYPES = {
  phase: PreviewPhaseNode,
  group: PreviewGroupNode,
  topic: PreviewTopicNode,
};

/**
 * Marketing preview of the roadmap graph.
 *
 * Shows the first phase expanded into its real groups plus a sample of topics, so
 * visitors see the actual structure without any database round trip and without a
 * working session. It is explicitly labelled as a preview: nothing here is
 * interactive state a learner could mistake for their own progress.
 */
function PreviewInner() {
  const phase = PHASE_1_OUTLINE;

  const nodes: Node[] = React.useMemo(() => {
    const result: Node[] = [
      {
        id: `phase-${phase.order}`,
        type: "phase",
        position: { x: 0, y: 0 },
        data: { phase },
      },
    ];

    phase.groups.slice(0, 3).forEach((group, column) => {
      result.push({
        id: `group-${column}`,
        type: "group",
        position: { x: PHASE_WIDTH + 60 + column * GROUP_GAP, y: 0 },
        data: {
          title: group,
          color: phase.color,
          count: Math.max(2, Math.round(phase.topics / phase.groups.length)),
        },
      });
    });

    ["Closures", "The event loop", "Promises"].forEach((label, index) => {
      result.push({
        id: `topic-${index}`,
        type: "topic",
        position: { x: PHASE_WIDTH + 60 + GROUP_GAP + 24, y: ROW_GAP * (index + 1) },
        data: { label },
      });
    });

    return result;
  }, [phase]);

  const edges: Edge[] = React.useMemo(
    () => [
      ...phase.groups.slice(0, 3).map((_, column) => ({
        id: `e-${column}`,
        source: `phase-${phase.order}`,
        target: `group-${column}`,
        type: "smoothstep" as const,
      })),
      ...[0, 1, 2].map((index) => ({
        id: `et-${index}`,
        source: "group-1",
        target: `topic-${index}`,
        type: "smoothstep" as const,
      })),
    ],
    [phase],
  );

  return (
    <div className="relative h-[520px] overflow-hidden rounded-xl border border-border">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        zoomOnScroll={false}
        panOnDrag={false}
        preventScrolling={false}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.4}
        maxZoom={1.2}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1.25} />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap pannable={false} zoomable={false} position="bottom-right" />

        <Panel position="top-left" className="!m-3">
          <div className="rounded-lg border border-border bg-card/95 px-3 py-2 backdrop-blur">
            <p className="text-xs font-semibold">Preview · Phase {phase.order}: {phase.title}</p>
            <p className="text-[11px] text-muted-foreground">
              {phase.topics} topics across {phase.groups.length} groups
            </p>
          </div>
        </Panel>
      </ReactFlow>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center bg-gradient-to-t from-background to-transparent p-4">
        <Link
          href="/login"
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-xs font-medium shadow-card transition-colors hover:border-primary/50"
        >
          Sign in to expand all 15 phases and track progress
          <ChevronRight className="size-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

export function RoadmapPreview() {
  return (
    <ReactFlowProvider>
      <PreviewInner />
    </ReactFlowProvider>
  );
}