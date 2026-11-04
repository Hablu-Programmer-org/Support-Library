import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { eyebrowClass } from "@/lib/ui";

type PageHeaderProps = {
  /** Rendered as the page <h1> — e2e tests assert these exact texts. */
  title: string;
  description?: string;
  /** Small caps label above the title (e.g. "Operations"). */
  eyebrow?: string;
  /** Right-aligned action slot (e.g. a "create" button). */
  action?: ReactNode;
  /** Optional row rendered above the title (badges, status chips). */
  meta?: ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  action,
  meta,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className={cn(eyebrowClass, "mb-1.5")}>{eyebrow}</p>}
        {meta && <div className="mb-2 flex flex-wrap items-center gap-2">{meta}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-[28px] dark:text-white">
          {title}
        </h1>
        {description && (
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {description}
          </p>
        )}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
