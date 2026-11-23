import Link from "next/link";

import { VideoIcon } from "@/components/icons";
import { StatusBadge } from "@/components/issues/status-badge";
import { CopyValue } from "@/components/shared/copy-value";
import { EmptyState } from "@/components/shared/empty-state";
import { formatSupportTime } from "@/lib/format-date";
import { buildIssueDetailHref } from "@/lib/issue-list-params";
import type { LiveSupportQueueEntry } from "@/lib/services/live-support-joins";
import { chipClass, focusRingClass, mutedTextClass, rowHoverClass, surfaceClass, surfaceHeaderClass } from "@/lib/ui";

const SHIFT_LABELS: Record<string, string> = {
  morning: "Morning shift",
  night: "Night shift",
};

/** Rows the dashboard rail shows before pointing at the full queue. */
export const COMPACT_QUEUE_ROWS = 5;

/**
 * Who is waiting in the room today, newest first.
 *
 * Staff-only: the page that renders it requires a mentor or admin session, and
 * the entries come from `live-support-joins` (today's `dayKey` only), so old
 * joins are neither stored nor listed here.
 */
export function LiveSupportJoinQueue({
  entries,
  dayKey,
  variant = "full",
}: {
  entries: LiveSupportQueueEntry[];
  dayKey: string;
  /** `compact` is the dashboard rail: newest few rows, one-line empty, link to the full queue. */
  variant?: "full" | "compact";
}) {
  if (variant === "compact") return <CompactQueue entries={entries} />;

  return (
    <section aria-labelledby="live-support-queue-heading" className={surfaceClass}>
      <div className={surfaceHeaderClass}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
            <VideoIcon size={16} />
          </span>
          <div className="min-w-0">
            <h2
              className="text-sm font-semibold text-slate-900 dark:text-white"
              id="live-support-queue-heading"
            >
              Waiting today
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {dayKey} · Asia/Dhaka · newest first
            </p>
          </div>
        </div>
        <span className={chipClass}>{entries.length} waiting</span>
      </div>

      {entries.length === 0 ? (
        <>
          <EmptyState className="rounded-none border-0 bg-transparent dark:bg-transparent">
            No student has joined the room yet today.
          </EmptyState>
          <p className="px-4 pb-4 text-center text-xs leading-5 text-slate-500 dark:text-slate-400">
            A row appears the moment a student presses{" "}
            <span className="font-semibold">Join</span> on their own request page. Submitting a
            request alone does not queue anyone.
          </p>
        </>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className={`flex flex-col gap-2 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between ${rowHoverClass}`}
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {entry.studentName}
                  {entry.studentEmail && (
                    <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">
                      {entry.studentEmail}
                    </span>
                  )}
                </p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {entry.caseRef ? (
                    <CopyValue label="request reference" value={entry.caseRef} variant="chip" />
                  ) : (
                    <span aria-hidden="true">—</span>
                  )}{" "}
                  {entry.issueDeleted ? (
                    <span className="text-slate-500 dark:text-slate-400">
                      {entry.issueTitle} (removed)
                    </span>
                  ) : (
                    <Link
                      className="text-primary hover:underline dark:text-primary-300"
                      href={buildIssueDetailHref({ id: entry.issueId, caseRef: entry.caseRef })}
                    >
                      {entry.issueTitle}
                    </Link>
                  )}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {entry.issueStatus && <StatusBadge status={entry.issueStatus} />}
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {SHIFT_LABELS[entry.shift] ?? entry.shift} ·{" "}
                  {formatSupportTime(entry.joinedAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CompactQueue({ entries }: { entries: LiveSupportQueueEntry[] }) {
  const shown = entries.slice(0, COMPACT_QUEUE_ROWS);
  const hidden = entries.length - shown.length;

  return (
    <section aria-labelledby="live-support-queue-heading" className={surfaceClass}>
      <div className={surfaceHeaderClass}>
        <h2
          className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white"
          id="live-support-queue-heading"
        >
          <VideoIcon aria-hidden className="text-violet-600 dark:text-violet-300" size={16} />
          Waiting today
        </h2>
        <Link
          className={`rounded text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300 ${focusRingClass}`}
          href="/dashboard/live-support"
        >
          Live support →
        </Link>
      </div>

      {shown.length === 0 ? (
        <p className={`px-4 py-3 text-sm ${mutedTextClass}`}>No one has joined the room today.</p>
      ) : (
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {shown.map((entry) => (
            <li key={entry.id} className={`space-y-1 px-4 py-3 ${rowHoverClass}`}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {entry.studentName}
                </p>
                <time
                  className={`shrink-0 text-xs tabular-nums ${mutedTextClass}`}
                  dateTime={entry.joinedAt.toISOString()}
                >
                  {formatSupportTime(entry.joinedAt)}
                </time>
              </div>
              <div className="flex min-w-0 items-center gap-2 text-sm">
                {entry.caseRef && (
                  <span className="shrink-0 font-mono text-xs font-semibold text-primary-700 dark:text-primary-300">
                    #{entry.caseRef}
                  </span>
                )}
                {entry.issueDeleted ? (
                  <span className={`truncate ${mutedTextClass}`}>{entry.issueTitle} (removed)</span>
                ) : (
                  <Link
                    className="truncate text-slate-700 hover:underline dark:text-slate-300"
                    href={buildIssueDetailHref({ id: entry.issueId, caseRef: entry.caseRef })}
                  >
                    {entry.issueTitle}
                  </Link>
                )}
                {entry.issueStatus && (
                  <span className="ml-auto shrink-0">
                    <StatusBadge status={entry.issueStatus} />
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {hidden > 0 && (
        <Link
          className={`block border-t border-slate-200 px-4 py-2.5 text-xs font-semibold text-cyan-700 hover:underline dark:border-slate-800 dark:text-cyan-300 ${focusRingClass}`}
          href="/dashboard/live-support"
        >
          {hidden} more today →
        </Link>
      )}
    </section>
  );
}
