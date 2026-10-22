import Link from "next/link";

import { StatusBadge } from "@/components/issues/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { SUPPORT_TIME_ZONE } from "@/lib/config/live-support";
import type { LiveSupportQueueEntry } from "@/lib/services/live-support-joins";

const SHIFT_LABELS: Record<string, string> = {
  morning: "Morning shift",
  night: "Night shift",
};

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SUPPORT_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

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
}: {
  entries: LiveSupportQueueEntry[];
  dayKey: string;
}) {
  if (entries.length === 0) {
    return (
      <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
        <EmptyState>No student has joined the room yet today.</EmptyState>
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          A row appears the moment a student presses <span className="font-semibold">Join</span> on
          their own request page. Submitting a request alone does not queue anyone.
        </p>
        <p className="mt-1 text-center text-xs text-slate-500 dark:text-slate-400">
          Support day {dayKey} (Asia/Dhaka).
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="live-support-queue-heading"
      className="space-y-3 border-t border-slate-200 pt-6 dark:border-slate-800"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2
          id="live-support-queue-heading"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Waiting today
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {dayKey} · Asia/Dhaka · newest first
        </p>
      </div>

      <ul className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-2 py-4 sm:flex-row sm:items-start sm:justify-between">
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
                <span className="select-all font-mono text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {entry.caseRef}
                </span>{" "}
                {entry.issueDeleted ? (
                  <span className="text-slate-500 dark:text-slate-400">
                    {entry.issueTitle} (removed)
                  </span>
                ) : (
                  <Link
                    className="text-primary hover:underline dark:text-primary-300"
                    href={`/dashboard/issues/${entry.issueId}`}
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
                {timeFormatter.format(entry.joinedAt)}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
