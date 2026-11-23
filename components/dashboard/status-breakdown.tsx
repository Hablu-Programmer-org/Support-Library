import Link from "next/link";

import { STATUS_LABELS } from "@/components/issues/status-badge";
import { cn } from "@/lib/cn";
import { buildIssueListHref, DEFAULT_ISSUE_FILTERS } from "@/lib/issue-list-params";
import type { StatusCount, UnresolvedStatus } from "@/lib/status-breakdown";
import { focusRingClass, surfaceClass, surfaceHeaderClass } from "@/lib/ui";

const DOT: Record<UnresolvedStatus, string> = {
  OPEN: "bg-cyan-500",
  PENDING: "bg-amber-500",
  AWAITING_STUDENT: "bg-orange-500",
  FOLLOW_UP: "bg-violet-500",
};

const issuesWord = (count: number) => (count === 1 ? "issue" : "issues");

/** Unresolved issues split by status; each cell opens the list filtered to it. */
export function StatusBreakdown({ counts }: { counts: StatusCount[] }) {
  return (
    <section aria-labelledby="status-breakdown-heading" className={surfaceClass}>
      <div className={surfaceHeaderClass}>
        <h2
          className="text-sm font-semibold text-slate-900 dark:text-white"
          id="status-breakdown-heading"
        >
          Unresolved by status
        </h2>
      </div>
      <ul className="grid grid-cols-2 divide-slate-200 sm:grid-cols-4 sm:divide-x dark:divide-slate-800">
        {counts.map(({ status, count }, index) => (
          <li
            key={status}
            className={cn(
              // Mobile is a 2×2 grid: rule between the rows and between the columns.
              index >= 2 && "border-t border-slate-200 sm:border-t-0 dark:border-slate-800",
              index % 2 === 1 && "border-l border-slate-200 sm:border-l-0 dark:border-slate-800",
            )}
          >
            <Link
              aria-label={`${STATUS_LABELS[status]}: ${count} ${issuesWord(count)}`}
              className={cn(
                "flex min-h-[72px] flex-col justify-center gap-1 px-4 py-3 transition-colors duration-150 hover:bg-slate-50 motion-reduce:transition-none dark:hover:bg-slate-800/40",
                focusRingClass,
              )}
              href={buildIssueListHref({ ...DEFAULT_ISSUE_FILTERS, status, page: 1 })}
            >
              <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", DOT[status])} />
                {STATUS_LABELS[status]}
              </span>
              <span
                className={cn(
                  "text-xl font-semibold tabular-nums",
                  count === 0 ? "text-slate-400 dark:text-slate-500" : "text-slate-900 dark:text-white",
                )}
              >
                {count}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
