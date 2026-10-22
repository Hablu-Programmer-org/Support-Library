import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deleteIssueActionSimple,
} from "@/actions/issues";
import { ArchiveIssueButton } from "@/components/issues/archive-issue-button";
import { IssueStatusForm } from "@/components/issues/issue-status-form";
import { PublishIssueForm } from "@/components/issues/publish-issue-form";
import { StudentRequestView } from "@/components/issues/student-request-view";
import { IssueTimeline } from "@/components/issues/issue-timeline";
import { ReplyComposer } from "@/components/issues/reply-composer";
import { StatusBadge } from "@/components/issues/status-badge";
import { AttachmentList } from "@/components/shared/attachment-list";
import { LinkList } from "@/components/shared/link-list";
import {
  ArrowLeftIcon,
  FileTextIcon,
  MessageSquareIcon,
  SettingsIcon,
  UserIcon,
  WarningTriangleIcon,
} from "@/components/icons";
import { requireSession } from "@/lib/auth-guard";
import { caseRefFor } from "@/lib/config/live-support";
import { canMutate, isAdmin } from "@/lib/roles";
import { getIssueDetail, getOwnIssueDetail, getPublishedIssueDetail } from "@/lib/services/issues";
import { listReplies } from "@/lib/services/replies";
import { CASE_STATUSES } from "@/models";
import { generateCsrfToken } from "@/lib/csrf";

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
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const { created } = (await searchParams) ?? {};
  const session = await requireSession();
  const canEdit = Boolean(session.user.role && canMutate(session.user.role));
  const canPublish = isAdmin(session.user.role ?? "STUDENT");
  const staffIssue = canEdit ? await getIssueDetail(id) : null;

  if (!staffIssue) {
    // A student may read their own request whatever its visibility. Anyone else
    // still falls through to the published library or a 404, so an unpublished
    // case never opens up. Ownership comes from `createdBy`, not the URL.
    const ownedIssue = await getOwnIssueDetail(id, session.user.id);
    if (ownedIssue) {
      const [replies, csrfToken] = await Promise.all([
        listReplies(ownedIssue.id, true),
        generateCsrfToken(session.user.id),
      ]);

      return (
        <StudentRequestView
          created={created === "1"}
          csrfToken={csrfToken}
          issue={ownedIssue}
          replies={replies}
        />
      );
    }
  }

  const supportIssue = staffIssue ?? (await getPublishedIssueDetail(id));
  if (!supportIssue) notFound();

  const replies = await listReplies(supportIssue.id, !canEdit);
  const csrfToken = await generateCsrfToken(session.user.id);

  return (
    <div className="mx-auto w-full max-w-6xl py-6">
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
            {priorityLabels[supportIssue.priority ?? "NORMAL"] ??
              supportIssue.priority}
          </span>
          {supportIssue.visibility === "PUBLISHED" && (
            <span className="rounded-full bg-success-100 px-2.5 py-1 font-medium text-success-700 dark:bg-success-950/50 dark:text-success-200">
              Student Library
            </span>
          )}
        </div>
        <h1 className="max-w-4xl text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          {supportIssue.title}
        </h1>
        <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
          Updated{" "}
          <time dateTime={supportIssue.updatedAt?.toISOString()}>
            {formatDate(supportIssue.updatedAt)}
          </time>
        </p>
      </header>

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="min-w-0 space-y-8">
          <section aria-labelledby="problem-heading" className="pb-8">
            <div className="mb-4 flex items-center gap-2">
              <FileTextIcon size={16} className="text-slate-400 dark:text-slate-500" />
              <h2
                id="problem-heading"
                className="text-xl font-semibold text-slate-950 dark:text-white"
              >
                The problem
              </h2>
            </div>
            <div className="space-y-4">
              <p className="whitespace-pre-wrap wrap-break-word text-base leading-8 text-slate-700 dark:text-slate-200 sm:text-lg max-w-3xl">
                {supportIssue.question}
              </p>
              <LinkList videoLinks={supportIssue.videoLinks} />
              {/* `staffIssue` is set only for staff; the published projection has
                  no uploads at all, so students never receive their ids. */}
              <AttachmentList uploads={staffIssue?.uploads ?? []} />
              {supportIssue.tags.length > 0 && (
                <div
                  className="mt-7 flex flex-wrap gap-2"
                  aria-label="Issue tags"
                >
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
          </section>

          <section aria-labelledby="responses-heading" className="space-y-6">
            <div className="flex items-center gap-2">
              <MessageSquareIcon size={16} className="text-slate-400 dark:text-slate-500" />
              <div>
                <h2
                  id="responses-heading"
                  className="text-lg font-semibold text-slate-950 dark:text-white"
                >
                  {canEdit ? "Responses" : "Answers and updates"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {canEdit
                    ? "Reviewed answers and updates in chronological order."
                    : "Guidance reviewed by the Hablu Programmer support team."}
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              <div className="py-6">
                <IssueTimeline
                  issueId={supportIssue.id}
                  replies={replies}
                  viewerId={session.user.id}
                  viewerRole={session.user.role}
                  csrfToken={csrfToken}
                />
              </div>
              {canEdit && (
                <div className="py-6">
                  <ReplyComposer issueId={supportIssue.id} csrfToken={csrfToken} />
                </div>
              )}
            </div>
          </section>
        </main>

        <aside className="space-y-0 lg:sticky lg:top-20">
          <section className="border-t border-slate-200 py-6 first:border-t-0 first:pt-0 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <SettingsIcon className="text-slate-400" size={16} />
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Issue context
              </h2>
            </div>
            <dl className="mt-3 space-y-3 text-sm">
              <Info label="Course" value={supportIssue.courseSlug} />
              <Info label="Batch" value={supportIssue.batchNo?.toString()} />
              <Info
                label="Published"
                value={formatDate(supportIssue.publishedAt)}
              />
              <Info
                label="Created"
                value={formatDate(supportIssue.createdAt)}
              />
              {staffIssue && (
                <Info label="Reference" value={caseRefFor(supportIssue.id)} />
              )}
              {staffIssue && (
                <Info
                  label="Live support"
                  value={formatDate(staffIssue.lastLiveSupportAt)}
                />
              )}
            </dl>
          </section>

          {staffIssue && (
            <section className="border-t border-slate-200 py-6 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <UserIcon className="text-slate-400" size={16} />
                <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                  Student snapshot
                </h2>
              </div>
              <p className="mt-3 wrap-break-word font-medium text-slate-900 dark:text-white">
                {staffIssue.studentName || "General issue (no student)"}
              </p>
              <p className="mt-1 break-all text-sm text-slate-500 dark:text-slate-400">
                {staffIssue.studentEmail ?? "No student identity recorded"}
              </p>
            </section>
          )}

          {canEdit && (
            <section className="border-t border-slate-200 py-6 dark:border-slate-800">
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
                Manage issue
              </h2>
              <IssueStatusForm
                csrfToken={csrfToken}
                expectedUpdatedAt={supportIssue.updatedAt?.toISOString() ?? ""}
                issueId={supportIssue.id}
                options={CASE_STATUSES.filter((status) => status !== "ARCHIVED").map(
                  (status) => ({ value: status, label: statusLabels[status] }),
                )}
                status={supportIssue.status}
              />

              <Link
                href={`/dashboard/issues/${supportIssue.id}/edit`}
                className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Edit issue details
              </Link>

              {canPublish && (
                <PublishIssueForm
                  issueId={supportIssue.id}
                  reviewedAt={supportIssue.updatedAt?.toISOString() ?? ""}
                  isPublished={supportIssue.visibility === "PUBLISHED"}
                  csrfToken={csrfToken}
                />
              )}
            </section>
          )}

          {canEdit && (
            <section className="border-t-2 border-danger-300 py-6 dark:border-danger-300/70">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-danger-600 text-white dark:bg-danger-300 dark:text-danger-900">
                  <WarningTriangleIcon size={21} />
                </span>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-danger-600 dark:text-danger-700">
                    Danger zone
                  </p>
                  <h2 className="mt-0.5 text-base font-bold text-danger-900 dark:text-slate-50">
                    Archive this issue
                  </h2>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-danger-900/80 dark:text-slate-300">
                Remove this issue from active staff lists and the student
                library. Archive it only when no further action is needed.
              </p>
              <ArchiveIssueButton
                action={deleteIssueActionSimple.bind(null, supportIssue.id)}
                csrfToken={csrfToken}
              />
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
      <dd className="mt-1 wrap-break-word font-medium text-slate-800 dark:text-slate-200">
        {value || "Not specified"}
      </dd>
    </div>
  );
}
