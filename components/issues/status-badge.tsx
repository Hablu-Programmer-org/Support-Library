import type { CaseStatus } from "@/models";

const statusLabel: Record<CaseStatus, string> = {
  OPEN: "Open",
  SOLVED: "Solved",
  PENDING: "Pending",
  FOLLOW_UP: "Follow-up",
  ARCHIVED: "Archived",
};

const statusClass: Record<CaseStatus, string> = {
  OPEN: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-200",
  SOLVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-200",
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-200",
  FOLLOW_UP: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-200",
  ARCHIVED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

export function StatusBadge({ status }: { status: CaseStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClass[status]}`}>
      {statusLabel[status]}
    </span>
  );
}