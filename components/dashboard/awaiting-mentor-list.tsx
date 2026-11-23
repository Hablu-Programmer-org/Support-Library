import Link from "next/link";

import { StatusBadge } from "@/components/issues/status-badge";
import type { CaseStatus } from "@/lib/constants";
import { formatSupportDate, formatSupportRelative } from "@/lib/format-date";
import { buildIssueDetailHref } from "@/lib/issue-list-params";
import { focusRingClass, mutedTextClass, rowHoverClass, surfaceClass, surfaceHeaderClass } from "@/lib/ui";

export type AwaitingMentorItem = {
  id: string;
  caseRef: string | null;
  title: string;
  status: CaseStatus;
  createdAt?: Date;
};

/**
 * Student requests no mentor has picked up, oldest first — the dashboard's
 * main work queue. `total` is the full queue size; only `items` are listed.
 */
export function AwaitingMentorList({
  items,
  total,
  now,
}: {
  items: AwaitingMentorItem[];
  total: number;
  now: Date;
}) {
  return (
    <section aria-labelledby="awaiting-mentor-heading" className={surfaceClass}>
      <div className={surfaceHeaderClass}>
        <div className="flex items-baseline gap-2">
          <h2
            className="text-sm font-semibold text-slate-900 dark:text-white"
            id="awaiting-mentor-heading"
          >
            Needs a mentor
          </h2>
          <span className={`text-xs ${mutedTextClass}`}>Oldest first</span>
        </div>
        <Link
          className={`rounded text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300 ${focusRingClass}`}
          href="/dashboard/issues"
        >
          All issues →
        </Link>
      </div>

      {items.length === 0 ? (
        <p className={`px-4 py-3 text-sm ${mutedTextClass}`}>Every student request has a mentor.</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {items.map((issue) => (
            <li key={issue.id}>
              <Link
                className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:grid-cols-[4.5rem_minmax(0,1fr)_auto_4.5rem] ${rowHoverClass} ${focusRingClass}`}
                href={buildIssueDetailHref(issue, "/dashboard")}
              >
                <span className="hidden font-mono text-xs font-semibold text-primary-700 sm:block dark:text-primary-300">
                  {issue.caseRef ? `#${issue.caseRef}` : "—"}
                </span>
                <span className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {issue.title}
                </span>
                <span className="justify-self-end">
                  <StatusBadge status={issue.status} />
                </span>
                <span className={`col-span-2 text-xs tabular-nums sm:col-span-1 sm:text-right ${mutedTextClass}`}>
                  <span className="font-mono font-semibold text-primary-700 sm:hidden dark:text-primary-300">
                    {issue.caseRef ? `#${issue.caseRef} · ` : ""}
                  </span>
                  {issue.createdAt ? (
                    <time dateTime={issue.createdAt.toISOString()} title={formatSupportDate(issue.createdAt)}>
                      {formatSupportRelative(issue.createdAt, now)}
                    </time>
                  ) : (
                    "—"
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {total > items.length && (
        <p className={`border-t border-slate-200 px-4 py-2.5 text-xs dark:border-slate-800 ${mutedTextClass}`}>
          Showing the oldest {items.length} of {total}.
        </p>
      )}
    </section>
  );
}
