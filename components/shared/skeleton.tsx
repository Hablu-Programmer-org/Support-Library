import { cn } from "@/lib/cn";

/**
 * Consistent loading placeholder. Use for route-level skeletons and any
 * in-flight placeholder so the radius/animation/color never drift.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700", className)}
    />
  );
}
