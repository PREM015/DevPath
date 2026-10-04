"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-tight whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-primary/20 bg-primary/10 text-primary",
        neutral: "border-neutral-500/20 bg-neutral-500/10 text-neutral-600 dark:text-neutral-400",
        success: "border-green-500/20 bg-green-500/10 text-green-600 dark:text-green-400",
        info: "border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400",
        warning: "border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
        danger: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
        outline: "border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> &
  VariantProps<typeof badgeVariants>;

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };