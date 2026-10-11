import Link from "next/link";
import { notFound } from "next/navigation";

import {
  changeIssueStatusActionSimple,
  deleteIssueActionSimple,
} from "@/actions/issues";
import { ArchiveIssueButton } from "@/components/issues/archive-issue-button";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import { PublishIssueForm } from "@/components/issues/publish-issue-form";
import { IssueTimeline } from "@/components/issues/issue-timeline";
import { ReplyComposer } from "@/components/issues/reply-composer";
import { StatusBadge } from "@/components/issues/status-badge";
import {
  ArrowLeftIcon,
  FileTextIcon,
  MessageSquareIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons";
import { requireSession } from "@/lib/auth-guard";
import { nativeSelectClass } from "@/lib/config/fields";
import { canMutate, isAdmin } from "@/lib/roles";
import {
  getIssueDetail,
  getPublishedIssueDetail,
} from "@/lib/services/issues";
import { listReplies } from "@/lib/services/replies";
import { CASE_STATUSES } from "@/models";

export const dynamic = "force-dynamic";

const statusLabels = {
  OPEN: "Open",
  SOLVED: "Solved",
  PENDING: "Pending",
  FOLLOW_UP: "Follow-up",
  ARCHIVED: "Archived",
};

const priorityLabels: Record<string, string> = {
  LOW: "Low priority",
  NORMAL: "Normal priority",
  HIGH: "High priority",
  URGENT: "Urgent",
};

const formatDate = (date?: Date | null) =>
  date
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(date))
    : "Not available";

export default async function IssueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const canEdit = Boolean(session.user.role && canMutate(session.user.role));
  const canPublish = isAdmin(session.user.role ?? "VIEWER");
  const staffIssue = canEdit ? await getIssueDetail(id) : null;
  const supportIssue = staffIssue ?? (await getPublishedIssueDetail(id));
  if (!supportIssue) notFound();

  const replies = await listReplies(supportIssue.id, canEdit, !canEdit);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/issues"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:text-primary-600 hover:underline"
      >
        <ArrowLeftIcon size={18} />
        Back to Issues
      </Link>

      <header className="mb-8 border-b border-slate-200 pb-8 dark:border-slate-800">
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <StatusBadge status={supportIssue.status} />
          <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {priorityLabels[supportIssue.priority ?? "NORMAL"] ?? supportIssue.priority}
          </span>
          {supportIssue.visibility === "PUBLISHED" && (
            <span className="rounded-full bg-success-100 px-2.5 py-1 font-medium text-success-700 dark:bg-success-950/50 dark:text-success-200">
              Student Library
            </span>
          )}
        </div>
        <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
          {supportIssue.title}
        </h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Updated <time dateTime={supportIssue.updatedAt?.toISOString()}>{formatDate(supportIssue.updatedAt)}</time>
        </p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0 space-y-8">
          <article
            aria-labelledby="problem-heading"
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-7">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                <FileTextIcon size={19} />
              </span>
              <h2 id="problem-heading" className="text-lg font-semibold text-slate-950 dark:text-white">
                The problem
              </h2>
            </div>
            <div className="px-5 py-6 sm:px-7 sm:py-8">
              <p className="whitespace-pre-wrap break-words text-base leading-8 text-slate-700 dark:text-slate-200 sm:text-lg">
                {supportIssue.question}
              </p>
              {supportIssue.tags.length > 0 && (
                <div className="mt-7 flex flex-wrap gap-2" aria-label="Issue tags">
                  {supportIssue.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </article>

          <section aria-labelledby="responses-heading" className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                <MessageSquareIcon size={19} />
              </span>
              <div>
                <h2 id="responses-heading" className="text-xl font-semibold text-slate-950 dark:text-white">
                  {canEdit ? "Responses and staff notes" : "Answers and updates"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {canEdit
                    ? "Public answers and private team context in chronological order."
                    : "Guidance reviewed by the Hablu Programmer support team."}
                </p>
              </div>
            </div>

            <IssueTimeline
              issueId={supportIssue.id}
              replies={replies}
              viewerId={session.user.id}
              viewerRole={session.user.role}
            />

            {canEdit && <ReplyComposer issueId={supportIssue.id} />}
          </section>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-20">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-2">
              <SettingsIcon className="text-slate-500" size={18} />
              <h2 className="font-semibold text-slate-950 dark:text-white">Issue context</h2>
            </div>
            <dl className="space-y-4 text-sm">
              <Info label="Course" value={supportIssue.courseSlug} />
              <Info label="Batch" value={supportIssue.batchNo?.toString()} />
              <Info label="Published" value={formatDate(supportIssue.publishedAt)} />
              <Info label="Created" value={formatDate(supportIssue.createdAt)} />
            </dl>
          </section>

          {staffIssue && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-2">
                <UserIcon className="text-slate-500" size={18} />
                <h2 className="font-semibold text-slate-950 dark:text-white">Student snapshot</h2>
              </div>
              <p className="break-words font-medium text-slate-900 dark:text-white">
                {staffIssue.studentName}
              </p>
              <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">
                {staffIssue.studentEmail ?? "No email recorded"}
              </p>
            </section>
          )}

          {canEdit && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="font-semibold text-slate-950 dark:text-white">Manage issue</h2>
              <form
                action={changeIssueStatusActionSimple.bind(null, supportIssue.id)}
                className="mt-4 space-y-3"
              >
                <label htmlFor="issue-status" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Status
                </label>
                <select
                  id="issue-status"
                  name="status"
                  defaultValue={supportIssue.status}
                  className={nativeSelectClass}
                >
                  {CASE_STATUSES.filter((status) => status !== "ARCHIVED").map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
                <PendingSubmitButton label="Update status" pendingLabel="Updating..." />
              </form>

              <Link
                href={`/dashboard/issues/${supportIssue.id}/edit`}
                className="mt-3 inline-flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Edit issue details
              </Link>

              {canPublish && (
                <PublishIssueForm
                  issueId={supportIssue.id}
                  reviewedAt={supportIssue.updatedAt?.toISOString() ?? ""}
                  isPublished={supportIssue.visibility === "PUBLISHED"}
                />
              )}
            </section>
          )}

          {canEdit && (
            <section className="rounded-2xl border border-danger-200 bg-danger-50/60 p-5 dark:border-danger-900/50 dark:bg-danger-950/20">
              <h2 className="font-semibold text-danger-800 dark:text-danger-200">Danger zone</h2>
              <p className="mt-1 text-xs leading-5 text-danger-700/80 dark:text-danger-300/80">
                Archiving removes this issue from the active library and staff lists.
              </p>
              <ArchiveIssueButton action={deleteIssueActionSimple.bind(null, supportIssue.id)} />
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 break-words font-medium text-slate-800 dark:text-slate-200">
        {value || "Not specified"}
      </dd>
    </div>
  );
}
