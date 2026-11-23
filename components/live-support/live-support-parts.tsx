"use client";

import { CopyValue } from "@/components/shared/copy-value";
import { cn } from "@/lib/cn";
import {
  meetingCodeLabel,
  shiftRangeLabel,
  type SupportPhase,
  type SupportShift,
} from "@/lib/config/live-support";

/**
 * Pieces shared by the student's request panel and the staff join card, so the
 * two live support surfaces show the shift, the hours and the room the same way.
 */

export const liveSupportCardClass =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70";

export const liveSupportJoinClass = cn(
  "inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3 text-sm font-semibold transition",
  "bg-primary text-white hover:bg-primary-600",
  "focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950",
  "disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500 disabled:hover:bg-slate-200",
  "dark:disabled:bg-slate-800 dark:disabled:text-slate-400",
);

export const liveSupportErrorClass =
  "border-l-2 border-danger-500 pl-3 text-sm text-danger-700 dark:text-danger-300";

export function LiveStatusPill({ open }: { open: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        open
          ? "bg-success-500/15 text-success-700 dark:text-success-300"
          : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", open ? "bg-success-500" : "bg-slate-400")}
      />
      {open ? "Open now" : "Closed"}
    </span>
  );
}

const SHIFTS: Array<{ id: SupportShift; label: string }> = [
  { id: "morning", label: "Morning" },
  { id: "night", label: "Night" },
];

/** Both daily shifts as information (not controls), the current one marked. */
export function ShiftSchedule({ shift }: { shift: SupportPhase }) {
  return (
    <ul aria-label="Daily support hours" className="space-y-2">
      {SHIFTS.map(({ id, label }) => {
        const current = shift === id;
        return (
          <li
            key={id}
            aria-current={current ? "time" : undefined}
            className={cn(
              "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm",
              current
                ? "border-primary-500/40 bg-primary-500/10"
                : "border-slate-200 dark:border-slate-800",
            )}
          >
            <span
              className={cn(
                "font-medium",
                current
                  ? "text-primary-700 dark:text-primary-300"
                  : "text-slate-700 dark:text-slate-300",
              )}
            >
              {label}
              {current ? <span className="sr-only"> (now)</span> : null}
            </span>
            <span
              className={cn(
                "tabular-nums",
                current
                  ? "font-semibold text-slate-900 dark:text-white"
                  : "text-slate-500 dark:text-slate-400",
              )}
            >
              {shiftRangeLabel(id)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900 dark:text-white">
        <CopyValue label={label.toLowerCase()} value={value} />
      </dd>
    </div>
  );
}

/** Manual-entry values for the room, each copyable; renders nothing when both are absent. */
export function RoomDetails({
  platform,
  meetingId,
  passcode,
  className,
}: {
  platform: string;
  meetingId?: string | null;
  passcode?: string | null;
  className?: string;
}) {
  if (!meetingId && !passcode) return null;
  return (
    <dl
      className={cn(
        "divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800",
        className,
      )}
    >
      {meetingId ? <DetailRow label={meetingCodeLabel(platform)} value={meetingId} /> : null}
      {passcode ? <DetailRow label="Passcode" value={passcode} /> : null}
    </dl>
  );
}
