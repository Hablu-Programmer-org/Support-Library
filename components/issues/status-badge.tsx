import type { CaseStatus } from "@/models";

/**
 * Staff-facing (and neutral) label per status. `AWAITING_STUDENT` names who
 * holds the ball; only the owning student sees it phrased as "Needs your reply".
 */
export const STATUS_LABELS: Record<CaseStatus, string> = {
  OPEN: "Open",
  SOLVED: "Solved",
  PENDING: "Pending",
  AWAITING_STUDENT: "Waiting on student",
  FOLLOW_UP: "Follow-up",
  ARCHIVED: "Archived",
};

const statusClass: Record<CaseStatus, string> = {
  OPEN: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200",
  SOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
  AWAITING_STUDENT: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-200",
  FOLLOW_UP: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-200",
  ARCHIVED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

/** Who is looking: the student who owns the issue, or anyone else (staff, library readers). */
export type StatusViewer = "owner" | "other";

export function statusLabelFor(status: CaseStatus, viewer: StatusViewer = "other"): string {
  if (viewer === "owner" && status === "AWAITING_STUDENT") return "Needs your reply";
  return STATUS_LABELS[status];
}

export function StatusBadge({ status, viewer = "other" }: { status: CaseStatus; viewer?: StatusViewer }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass[status]}`}>
      {statusLabelFor(status, viewer)}
    </span>
  );
}