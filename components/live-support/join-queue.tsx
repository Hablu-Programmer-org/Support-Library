import Link from "next/link";

import { VideoIcon } from "@/components/icons";
import { StatusBadge } from "@/components/issues/status-badge";
import { CopyValue } from "@/components/shared/copy-value";
import { EmptyState } from "@/components/shared/empty-state";
import { SUPPORT_TIME_ZONE } from "@/lib/config/live-support";
import type { LiveSupportQueueEntry } from "@/lib/services/live-support-joins";
import { chipClass, rowHoverClass, surfaceClass, surfaceHeaderClass } from "@/lib/ui";

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
      )}
    </section>
  );
}
