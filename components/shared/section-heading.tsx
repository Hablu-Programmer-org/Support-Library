import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type SectionHeadingProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  right?: ReactNode;
  className?: string;
};

/**
 * Flat section heading — no card, no badge, no shadow. The icon is a small
 * inline glyph, not a boxed badge. Use on reading surfaces and inside a single
 * `Panel` for interactive surfaces.
 */
export function SectionHeading({
  title,
  description,
  icon,
  right,
  className,
}: SectionHeadingProps) {
  return (
    <div className={cn("flex items-start gap-2", className)}>
      {icon && (
        <span
          className="mt-0.5 shrink-0 text-slate-400 dark:text-slate-500"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </h2>
        {description && (
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}
