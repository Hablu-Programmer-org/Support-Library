import Link from "next/link";

import { ArrowLeftIcon, PencilIcon } from "@/components/icons";
import { CopyForAiButton } from "@/components/issues/copy-for-ai-button";
import { StatusBadge } from "@/components/issues/status-badge";
import { CopyValue } from "@/components/shared/copy-value";
import { formatSupportDate } from "@/lib/format-date";
import type { CaseStatus } from "@/models";

const priorityLabels: Record<string, string> = {
  LOW: "Low priority",
  NORMAL: "Normal priority",
  HIGH: "High priority",
  URGENT: "Urgent",
};

const priorityClass: Record<string, string> = {
  HIGH: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-200",
  URGENT: "bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-200",
};

const chip = "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium";
const neutralChip = "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300";

const actionClass =
  "inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800";

type IssueDetailHeaderProps = {
  title: string;
  status: CaseStatus;
  priority?: string | null;
  isPublished: boolean;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  backHref: string;
  backLabel: string;
  /** Staff (mentor or admin). Gates the reference and every action. */
  canEdit: boolean;
  /** Staff-only case reference. Ignored unless `canEdit`. */
  caseRef?: string | null;
  /** Edit page link. Ignored unless `canEdit`. */
  editHref?: string;
  /** Admin-only prompt, built server-side. Ignored unless `canEdit`. */
  aiPrompt?: string | null;
};

function MetaTime({ label, value }: { label: string; value?: Date | null }) {
  if (!value) return null;
  return (
    <span>
      {label}{" "}
      <time dateTime={value.toISOString()} className="font-medium text-slate-700 dark:text-slate-300">
        {formatSupportDate(value)}
      </time>
    </span>
  );
}

export function IssueDetailHeader({
  title,
  status,
  priority,
  isPublished,
  createdAt,
  updatedAt,
  backHref,
  backLabel,
  canEdit,
  caseRef,
  editHref,
  aiPrompt,
}: IssueDetailHeaderProps) {
  const priorityKey = priority ?? "NORMAL";
  const showRef = canEdit && Boolean(caseRef);
  const showAi = canEdit && Boolean(aiPrompt);
  const showEdit = canEdit && Boolean(editHref);

  return (
    <header className="mb-8">
      <Link
        href={backHref}
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-cyan-700 transition hover:text-cyan-600 hover:underline dark:text-cyan-300 dark:hover:text-cyan-200"
      >
        <ArrowLeftIcon size={18} />
        {backLabel}
      </Link>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <span className={`${chip} ${priorityClass[priorityKey] ?? neutralChip}`}>
              {priorityLabels[priorityKey] ?? priorityKey}
            </span>
            {isPublished ? (
              <span className={`${chip} bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200`}>
                Student Library
              </span>
            ) : null}
          </div>

          <h1 className="max-w-5xl wrap-break-word text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
            {title}
          </h1>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-slate-500 dark:text-slate-400">
            {showRef && caseRef ? (
              <CopyValue label="reference" value={caseRef} variant="chip" />
            ) : null}
            <MetaTime label="Created" value={createdAt} />
            {createdAt && updatedAt ? <span aria-hidden="true">·</span> : null}
            <MetaTime label="Updated" value={updatedAt} />
          </p>
        </div>

        {showAi || showEdit ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-end">
            {showAi && aiPrompt ? <CopyForAiButton prompt={aiPrompt} /> : null}
            {showEdit && editHref ? (
              <Link href={editHref} className={actionClass}>
                <PencilIcon size={16} />
                Edit issue details
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
