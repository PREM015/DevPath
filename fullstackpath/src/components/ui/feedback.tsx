import * as React from "react";
import Image from "next/image";
import { cn, initials } from "@/lib/utils";
import { Card } from "./card";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse-soft rounded-md bg-muted", className)} />;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
        {description && (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  tone = "default",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: "default" | "success" | "info" | "warning" | "muted";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "bg-primary/10 text-primary",
    success: "bg-green-500/10 text-green-600 dark:text-green-400",
    info: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    warning: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
          {sublabel && (
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{sublabel}</p>
          )}
        </div>
        {Icon && (
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              tones[tone],
            )}
          >
            <Icon className="size-4" />
          </div>
        )}
      </div>
    </Card>
  );
}

export function ProgressRing({
  value,
  size = 56,
  strokeWidth = 5,
  className,
  children,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`${Math.round(clamped)} percent complete`}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (clamped / 100) * circumference}
          className="stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <span className="absolute text-xs font-semibold tabular-nums">
        {children ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  );
}

export function Avatar({
  name,
  image,
  size = "md",
  className,
}: {
  name?: string | null;
  image?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = { sm: "size-7 text-[11px]", md: "size-9 text-xs", lg: "size-14 text-base" };

  if (image) {
    return (
      <Image
        src={image}
        alt={name ?? "Profile picture"}
        width={64}
        height={64}
        sizes="64px"
        className={cn("shrink-0 rounded-full object-cover", sizes[size], className)}
      />
    );
  }

  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary",
        sizes[size],
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const map: Record<string, { label: string; className: string }> = {
    BEGINNER: { label: "Beginner", className: "diff-beginner" },
    INTERMEDIATE: { label: "Intermediate", className: "diff-intermediate" },
    ADVANCED: { label: "Advanced", className: "diff-advanced" },
    SENIOR: { label: "Senior", className: "diff-senior" },
  };
  const item = map[difficulty] ?? map.BEGINNER!;
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", item.className)}>
      {item.label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    NOT_STARTED: { label: "Not started", className: "status-not-started" },
    IN_PROGRESS: { label: "In progress", className: "status-in-progress" },
    PRACTICED: { label: "Practiced", className: "status-practiced" },
    COMPLETED: { label: "Completed", className: "status-completed" },
    NEEDS_REVISION: { label: "Needs revision", className: "status-revision" },
    BLOCKED: { label: "Blocked", className: "status-blocked" },
  };
  const item = map[status] ?? map.NOT_STARTED!;
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-medium", item.className)}>
      {item.label}
    </span>
  );
}