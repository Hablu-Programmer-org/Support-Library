import type { ComponentProps, ReactNode } from "react";

import {
  ChevronDownIcon,
  SettingsIcon,
  UserIcon,
  WarningTriangleIcon,
} from "@/components/icons";
import { ArchiveIssueButton } from "@/components/issues/archive-issue-button";
import { IssueStatusForm } from "@/components/issues/issue-status-form";
import { PublishIssueForm } from "@/components/issues/publish-issue-form";
import { CopyValue } from "@/components/shared/copy-value";
import { formatSupportDate } from "@/lib/format-date";
import type { CaseStatus } from "@/models";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70";

type StaffSnapshot = {
  studentName?: string | null;
  studentEmail?: string | null;
  lastLiveSupportAt?: Date | null;
};

type IssueDetailSidebarProps = {
  issueId: string;
  status: CaseStatus;
  isPublished: boolean;
  /** ISO string of `updatedAt`, the optimistic-concurrency token for the forms. */
  updatedAtIso: string;
  /** Public case handle ("HSL-1042"); shown to every viewer. */
  caseRef?: string | null;
  courseSlug?: string | null;
  batchNo?: number | null;
  publishedAt?: Date | null;
  csrfToken: string;
  returnTo?: string;
  /** Staff (mentor or admin). Gates Manage, Student, Live support and Danger zone. */
  canEdit: boolean;
  /** Admin. Gates Publish. Ignored unless `canEdit`. */
  canPublish: boolean;
  /** Staff-only student identity. Ignored unless `canEdit`. */
  staff?: StaffSnapshot | null;
  statusOptions?: ComponentProps<typeof IssueStatusForm>["options"];
  archiveAction?: ComponentProps<typeof ArchiveIssueButton>["action"];
  /** Extra cards after the context (the owner's live support panel). */
  children?: ReactNode;
  /**
   * `all` (default): every card in one sticky aside.
   * `manage` / `context`: the case page renders Manage on its own, before the
   * main column in the DOM, so on a phone staff reach it right under the title;
   * on desktop the grid puts both parts in the right column.
   */
  part?: "all" | "manage" | "context";
  /**
   * A student reading someone else's published answer: Reference and
   * Published are case-handling data, so only Course and Batch remain. The
   * owner's own request (and staff) keep the reference to quote in support.
   */
  reader?: boolean;
  className?: string;
};

function CardTitle({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">
        {icon}
      </span>
      <h2 className="text-sm font-semibold text-slate-950 dark:text-white">
        {children}
      </h2>
    </div>
  );
}

function Info({
  label,
  value,
  valueNode,
  wide = false,
}: {
  label: string;
  value?: string | null;
  valueNode?: ReactNode;
  wide?: boolean;
}) {
  return (
    // Dates ("21 Nov 2026, 12:03 PM") take the full row so AM/PM never wraps alone.
    <div className={wide ? "col-span-2 min-w-0" : "min-w-0"}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 wrap-break-word text-sm font-medium text-slate-800 dark:text-slate-200">
        {valueNode ?? (value || "Not specified")}
      </dd>
    </div>
  );
}

export function IssueDetailSidebar({
  issueId,
  status,
  isPublished,
  updatedAtIso,
  caseRef,
  courseSlug,
  batchNo,
  publishedAt,
  csrfToken,
  returnTo,
  canEdit,
  canPublish,
  staff,
  statusOptions,
  archiveAction,
  children,
  part = "all",
  reader = false,
  className = "",
}: IssueDetailSidebarProps) {
  const staffView = canEdit ? (staff ?? null) : null;
  const showManage = canEdit && Boolean(statusOptions) && part !== "context";

  const manageCard = () =>
    statusOptions ? (
      <section className={card}>
        <CardTitle icon={<SettingsIcon size={16} />}>Manage issue</CardTitle>
        <IssueStatusForm
          autoPublish={canPublish}
          csrfToken={csrfToken}
          expectedUpdatedAt={updatedAtIso}
          issueId={issueId}
          isPublished={isPublished}
          options={statusOptions}
          status={status}
        />
        {canPublish ? (
          <PublishIssueForm
            issueId={issueId}
            reviewedAt={updatedAtIso}
            isPublished={isPublished}
            csrfToken={csrfToken}
            returnTo={returnTo}
          />
        ) : null}
      </section>
    ) : null;

  if (part === "manage") {
    if (!showManage) return null;
    return (
      <aside aria-label="Manage issue" className={className}>
        {manageCard()}
      </aside>
    );
  }

  return (
    // Sticky on desktop; a tall staff sidebar scrolls inside itself instead of
    // hiding its lower cards below the fold. p-1/-m-1 keeps focus rings unclipped.
    <aside
      aria-label="Issue sidebar"
      className={`space-y-4 lg:sticky lg:top-20 lg:-m-1 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto lg:p-1 ${className}`}
    >
      {showManage ? manageCard() : null}

      <section className={card}>
        <CardTitle icon={<SettingsIcon size={16} />}>Issue context</CardTitle>
        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
          {reader ? null : (
            <Info
              label="Reference"
              wide
              valueNode={
                caseRef ? (
                  <CopyValue label="reference" value={caseRef} variant="chip" />
                ) : undefined
              }
            />
          )}
          <Info label="Course" value={courseSlug} />
          <Info label="Batch" value={batchNo?.toString()} />
          {reader ? null : (
            <Info
              label="Published"
              value={
                publishedAt ? formatSupportDate(publishedAt) : "Not published"
              }
              wide
            />
          )}
          {staffView ? (
            <Info
              label="Live support"
              value={
                staffView.lastLiveSupportAt
                  ? formatSupportDate(staffView.lastLiveSupportAt)
                  : null
              }
              wide
            />
          ) : null}
        </dl>
      </section>

      {staffView ? (
        <section className={card}>
          <CardTitle icon={<UserIcon size={16} />}>Student snapshot</CardTitle>
          <p className="mt-3 wrap-break-word text-sm font-medium text-slate-900 dark:text-white">
            {staffView.studentName || "General issue (no student)"}
          </p>
          <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">
            {staffView.studentEmail ? (
              <CopyValue label="student email" value={staffView.studentEmail} />
            ) : (
              "No student identity recorded"
            )}
          </p>
        </section>
      ) : null}

      {children}

      {canEdit && archiveAction ? (
        <section className="rounded-2xl border border-danger-300 bg-white shadow-sm dark:border-danger-300/70 dark:bg-slate-900/70">
          {/* Closed by default: archiving is rare and final, so it stays one line
              until opened. The heading lives in <summary> so it is always found. */}
          <details className="group">
            {/* <summary> allows phrasing content plus one heading, so the layout is a
                grid of direct children rather than a wrapper around the h2. */}
            <summary className="grid min-h-11 cursor-pointer list-none grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 rounded-2xl p-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger-500 [&::-webkit-details-marker]:hidden">
              <span className="row-span-2 flex size-9 items-center justify-center rounded-md bg-danger-600 text-white dark:bg-danger-300 dark:text-danger-900">
                <WarningTriangleIcon size={18} />
              </span>
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-danger-600 dark:text-danger-700">
                Danger zone
              </span>
              <ChevronDownIcon
                size={16}
                aria-hidden="true"
                className="row-span-2 text-slate-400 transition group-open:rotate-180 motion-reduce:transition-none"
              />
              <h2 className="col-start-2 text-sm font-bold text-danger-900 dark:text-slate-50">
                Archive this issue
              </h2>
            </summary>
            <div className="px-4 pb-4">
              <p className="text-sm leading-6 text-danger-900/80 dark:text-slate-300">
                Remove this issue from active staff lists and the student
                library. Archive it only when no further action is needed.
              </p>
              <ArchiveIssueButton
                action={archiveAction}
                csrfToken={csrfToken}
                returnTo={returnTo}
              />
            </div>
          </details>
        </section>
      ) : null}
    </aside>
  );
}
