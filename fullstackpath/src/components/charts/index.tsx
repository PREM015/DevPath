"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/utils";

/**
 * Charts.
 *
 * Recharts runs client-side, so every chart is dynamically imported with
 * `ssr: false` by its page and wrapped here in a fixed-height container. That
 * keeps the server-rendered markup free of chart internals and avoids layout
 * shift while the chart mounts.
 */

const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "0.5rem",
  fontSize: "12px",
  color: "hsl(var(--popover-foreground))",
  boxShadow: "0 8px 24px -12px hsl(var(--foreground) / 0.28)",
} as const;

const AXIS_PROPS = {
  stroke: "hsl(var(--muted-foreground))",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export function ChartFrame({
  height = 240,
  children,
  className,
}: {
  height?: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div style={{ height }} className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

export type DailyPoint = {
  date: string;
  label: string;
  minutes: number;
  topicsCompleted: number;
  active: boolean;
};

export function StudyMinutesChart({ data }: { data: DailyPoint[] }) {
  return (
    <ChartFrame>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="minutes-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
        <YAxis {...AXIS_PROPS} width={40} unit="m" />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [`${value ?? 0} min`, "Studied"]}
          labelFormatter={(label) => `Day: ${label}`}
        />
        <Area
          type="monotone"
          dataKey="minutes"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          fill="url(#minutes-fill)"
          dot={false}
          activeDot={{ r: 3 }}
        />
      </AreaChart>
    </ChartFrame>
  );
}

export function CompletionsOverTimeChart({ data }: { data: DailyPoint[] }) {
  return (
    <ChartFrame>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
        <YAxis {...AXIS_PROPS} width={32} allowDecimals={false} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [`${value ?? 0}`, "Topics completed"]}
          labelFormatter={(label) => `Day: ${label}`}
        />
        <Bar dataKey="topicsCompleted" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartFrame>
  );
}

export type DifficultyRow = {
  difficulty: string;
  total: number;
  completed: number;
  started: number;
  percentage: number;
};

const DIFFICULTY_FILL: Record<string, string> = {
  BEGINNER: "hsl(var(--difficulty-beginner))",
  INTERMEDIATE: "hsl(var(--difficulty-intermediate))",
  ADVANCED: "hsl(var(--difficulty-advanced))",
  SENIOR: "hsl(var(--difficulty-senior))",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  BEGINNER: "Beginner",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
  SENIOR: "Senior",
};

export function DifficultyCompletionChart({ data }: { data: DifficultyRow[] }) {
  const rows = data.filter((row) => row.total > 0);
  if (rows.length === 0) return <EmptyChart label="No topics to chart yet" />;

  return (
    <ChartFrame height={220}>
      <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" {...AXIS_PROPS} domain={[0, 100]} unit="%" />
        <YAxis type="category" dataKey="difficulty" {...AXIS_PROPS} width={90} tickFormatter={(value) => DIFFICULTY_LABEL[String(value)] ?? String(value)} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value, _name, item) => {
            const row = item.payload as DifficultyRow;
            return [`${Number(value ?? 0)}% (${row.completed}/${row.total})`, "Completed"];
          }}
        />
        <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
          {rows.map((row) => (
            <Cell key={row.difficulty} fill={DIFFICULTY_FILL[row.difficulty]} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

export type PhaseRow = {
  id: string;
  title: string;
  order: number;
  color: string;
  total: number;
  completed: number;
  started: number;
  percentage: number;
};

export function PhaseCompletionChart({ data }: { data: PhaseRow[] }) {
  if (data.length === 0) return <EmptyChart label="No phases to chart yet" />;

  return (
    <ChartFrame height={Math.max(220, data.length * 26)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
        <XAxis type="number" {...AXIS_PROPS} domain={[0, 100]} unit="%" />
        <YAxis
          type="category"
          dataKey="title"
          {...AXIS_PROPS}
          width={150}
          tickFormatter={(value) => {
            const match = data.find((row) => row.title === value);
            return match ? `${match.order}. ${value.length > 22 ? `${value.slice(0, 21)}…` : value}` : value;
          }}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value, _name, item) => {
            const row = item.payload as PhaseRow;
            return [`${Number(value ?? 0)}% (${row.completed}/${row.total})`, "Completed"];
          }}
        />
        <Bar dataKey="percentage" radius={[0, 4, 4, 0]}>
          {data.map((row) => (
            <Cell key={row.id} fill={row.color} />
          ))}
        </Bar>
      </BarChart>
    </ChartFrame>
  );
}

export function StatusDonutChart({
  completed,
  practiced,
  inProgress,
  needsRevision,
  notStarted,
}: {
  completed: number;
  practiced: number;
  inProgress: number;
  needsRevision: number;
  notStarted: number;
}) {
  const data = [
    { name: "Completed", value: completed, fill: "hsl(var(--status-completed))" },
    { name: "Practiced", value: practiced, fill: "hsl(var(--status-practiced))" },
    { name: "In progress", value: inProgress, fill: "hsl(var(--status-in-progress))" },
    { name: "Needs revision", value: needsRevision, fill: "hsl(var(--status-revision))" },
    { name: "Not started", value: notStarted, fill: "hsl(var(--muted-foreground) / 0.35)" },
  ].filter((entry) => entry.value > 0);

  if (data.length === 0) return <EmptyChart label="Start a topic to see your breakdown" />;

  return (
    <ChartFrame height={220}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={52}
          outerRadius={82}
          paddingAngle={2}
          strokeWidth={0}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value, name) => [`${value ?? 0} topics`, name ?? ""]}
        />
        <Legend
          verticalAlign="bottom"
          height={28}
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
        />
      </PieChart>
    </ChartFrame>
  );
}

export function CumulativeCompletionsChart({
  data,
}: {
  data: { label: string; cumulative: number }[];
}) {
  if (data.length === 0) return <EmptyChart label="No completions yet" />;

  return (
    <ChartFrame>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
        <YAxis {...AXIS_PROPS} width={32} allowDecimals={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(value) => [`${value ?? 0}`, "Total completed"]} />
        <Line
          type="monotone"
          dataKey="cumulative"
          stroke="hsl(var(--primary))"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ChartFrame>
  );
}

export function ConsistencyHeatmap({
  data,
}: {
  data: { date: string; minutes: number; active: boolean }[];
}) {
  const weeks: { date: string; minutes: number }[][] = [];
  for (let i = 0; i < data.length; i += 7) {
    weeks.push(data.slice(i, i + 7).map((day) => ({ date: day.date, minutes: day.minutes })));
  }

  const intensity = (minutes: number) => {
    if (minutes === 0) return "bg-muted";
    if (minutes < 20) return "bg-primary/25";
    if (minutes < 45) return "bg-primary/45";
    if (minutes < 90) return "bg-primary/70";
    return "bg-primary";
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {weeks.map((week, weekIndex) => (
          <div key={weekIndex} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${day.minutes} min`}
                className={cn("size-3 rounded-sm", intensity(day.minutes))}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        Less
        <span className="size-3 rounded-sm bg-muted" />
        <span className="size-3 rounded-sm bg-primary/25" />
        <span className="size-3 rounded-sm bg-primary/45" />
        <span className="size-3 rounded-sm bg-primary/70" />
        <span className="size-3 rounded-sm bg-primary" />
        More
      </div>
    </div>
  );
}

export function StreakRadial({ current, longest }: { current: number; longest: number }) {
  const data = [{ name: "streak", value: Math.min(100, longest === 0 ? 0 : (current / longest) * 100) }];

  return (
    <div className="relative">
      <ChartFrame height={180}>
        <RadialBarChart
          innerRadius="70%"
          outerRadius="100%"
          data={data}
          startAngle={90}
          endAngle={-270}
        >
          <RadialBar
            dataKey="value"
            cornerRadius={8}
            fill="hsl(var(--primary))"
            background={{ fill: "hsl(var(--muted))" }}
          />
        </RadialBarChart>
      </ChartFrame>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums">{current}</span>
        <span className="text-xs text-muted-foreground">day streak</span>
      </div>
    </div>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">
      {label}
    </div>
  );
}