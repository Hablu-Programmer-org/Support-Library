import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type EmptyStateProps = {
  children: string;
  /** Optional supporting line under the main message. */
  description?: string;
  icon?: ReactNode;
  /** Optional next action (a link or button). */
  action?: ReactNode;
  className?: string;
};

/**
 * Dashed, low-contrast placeholder for a list with nothing in it. The main
 * message stays the first text node so existing copy assertions keep matching.
 */
export function EmptyState({
  children,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center dark:border-slate-700 dark:bg-slate-900/40",
        className,
      )}
    >
      {icon && (
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-slate-400 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-slate-500 dark:ring-slate-800"
          aria-hidden
        >
          {icon}
        </span>
      )}
      <p className="text-sm text-slate-600 dark:text-slate-300">{children}</p>
      {description && (
        <p className="max-w-md text-xs leading-5 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
