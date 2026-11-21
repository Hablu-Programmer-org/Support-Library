import type { CSSProperties } from "react";

import { cn } from "@/lib/cn";

/**
 * Consistent loading placeholder. Use for route-level skeletons and any
 * in-flight placeholder so the radius/animation/color never drift.
 */
export function Skeleton({
  className,
  style,
}: {
  className?: string;
  /** For data-driven sizes (e.g. varied pill widths) that no class covers. */
  style?: CSSProperties;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700", className)}
      style={style}
    />
  );
}
