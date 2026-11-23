import Link from "next/link";
import type { ReactNode } from "react";

import { ArrowDownIcon, ArrowLeftIcon, PencilIcon } from "@/components/icons";
import { CopyForAiButton } from "@/components/issues/copy-for-ai-button";
import { StatusBadge, type StatusViewer } from "@/components/issues/status-badge";
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
  /** The owning student sees "Needs your reply"; everyone else "Waiting on student". */
  statusViewer?: StatusViewer;
  priority?: string | null;
  isPublished: boolean;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  backHref: string;
  backLabel: string;
  /** Staff (mentor or admin). Gates the reference and every action. */
  canEdit: boolean;
  /** The student's own view hides triage priority. */
  showPriority?: boolean;
  /** Library readers are already in the library; the chip is for staff and owners. */
  showLibraryChip?: boolean;
  /** Extra control beside the back link (the owner's refresh probe). */
  backAside?: ReactNode;
  /** Edit page link. Ignored unless `canEdit`. */
  editHref?: string;
  /** Admin-only prompt, built server-side. Ignored unless `canEdit`. */
  aiPrompt?: string | null;
  /**
   * Library readers: the last staff answer replaces "Updated" (publishing or
   * retagging bumps `updatedAt`, which is not news to a reader).
   */
  lastAnswerAt?: Date | null;
  /** Readers: "Course name · Batch 10" in the meta line instead of a sidebar card. */
  courseLabel?: string | null;
  /** In-page link to the Solution reply, when the case has one. */
  solutionHref?: string;
};

function MetaTime({ label, value }: { label: string; value?: Date | null }) {
  if (!value) return null;
  return (
    <span className="whitespace-nowrap">
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
  statusViewer = "other",
  priority,
  isPublished,
  createdAt,
  updatedAt,
  backHref,
  backLabel,
  canEdit,
  showPriority = true,
  showLibraryChip = true,
  backAside,
  editHref,
  aiPrompt,
  lastAnswerAt,
  courseLabel,
  solutionHref,
}: IssueDetailHeaderProps) {
  const secondTime = lastAnswerAt
    ? { label: "Last answer", value: lastAnswerAt }
    : { label: "Updated", value: updatedAt };
  const priorityKey = priority ?? "NORMAL";
  const showAi = canEdit && Boolean(aiPrompt);
  const showEdit = canEdit && Boolean(editHref);

  return (
    <header className="mb-6 lg:mb-8">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 sm:mb-5">
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-cyan-700 transition hover:text-cyan-600 hover:underline dark:text-cyan-300 dark:hover:text-cyan-200"
        >
          <ArrowLeftIcon size={18} />
          {backLabel}
        </Link>
        {backAside}
      </div>

      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} viewer={statusViewer} />
            {showPriority ? (
              <span className={`${chip} ${priorityClass[priorityKey] ?? neutralChip}`}>
                {priorityLabels[priorityKey] ?? priorityKey}
              </span>
            ) : null}
            {isPublished && showLibraryChip ? (
              <span className={`${chip} bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200`}>
                Student Library
              </span>
            ) : null}
          </div>

          <h1 className="max-w-5xl wrap-break-word text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl dark:text-white">
            {title}
          </h1>

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
            <MetaTime label="Created" value={createdAt} />
            {createdAt && secondTime.value ? <span aria-hidden="true" className="hidden sm:inline">·</span> : null}
            <MetaTime label={secondTime.label} value={secondTime.value} />
            {courseLabel ? (
              <>
                <span aria-hidden="true" className="hidden sm:inline">·</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{courseLabel}</span>
              </>
            ) : null}
          </p>

          {solutionHref ? (
            <a
              href={solutionHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 motion-reduce:transition-none dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
            >
              <ArrowDownIcon size={16} />
              Jump to solution
            </a>
          ) : null}
        </div>

        {showAi || showEdit ? (
          <div className="grid shrink-0 grid-cols-2 gap-2 sm:flex sm:items-end">
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
