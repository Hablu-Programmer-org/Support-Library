import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { focusRingClass, surfaceClass } from "@/lib/ui";

type StatTone = "neutral" | "primary" | "warning" | "success" | "danger";

type StatCardProps = {
  label: string;
  value: number | string;
  hint?: string;
  icon?: ReactNode;
  tone?: StatTone;
  /** Makes the whole card a link to the queue that can act on this number. */
  href?: string;
  className?: string;
};

const TONE_ICON: Record<StatTone, string> = {
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  primary: "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  danger: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

/**
 * Compact metric card. The number is the loudest element, the label is a
 * small caps eyebrow and the hint explains what the number actually counts, so
 * a queue dashboard cannot be misread.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  href,
  className,
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
          {label}
        </p>
        {icon && (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
              TONE_ICON[tone],
            )}
            aria-hidden
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 text-3xl font-semibold leading-none tracking-tight text-slate-900 tabular-nums dark:text-white">
        {value}
      </p>
      {hint && (
        <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">{hint}</p>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        className={cn(
          surfaceClass,
          "block p-4 transition-colors duration-150 hover:border-cyan-400/70 hover:bg-cyan-50/40 motion-reduce:transition-none dark:hover:border-cyan-800 dark:hover:bg-cyan-950/20",
          focusRingClass,
          className,
        )}
        href={href}
      >
        {body}
      </Link>
    );
  }

  return <div className={cn(surfaceClass, "p-4", className)}>{body}</div>;
}
