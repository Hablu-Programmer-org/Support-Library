import Link from "next/link";
import { notFound } from "next/navigation";

import { changeIssueStatusActionSimple, deleteIssueActionSimple } from "@/actions/issues";
import { IssueForm } from "@/components/issues/issue-form";
import { IssueTimeline } from "@/components/issues/issue-timeline";
import { ReplyComposer } from "@/components/issues/reply-composer";
import { StatusBadge } from "@/components/issues/status-badge";
import { requireSession } from "@/lib/auth-guard";
import { nativeSelectClass } from "@/lib/config/fields";
import { canMutate } from "@/lib/roles";
import { getIssueDetail } from "@/lib/services/issues";
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

export default async function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const supportIssue = await getIssueDetail(id);
  if (!supportIssue) notFound();

  // VIEWER (students) must not see staff-only content: internal notes.
  // Staff (ADMIN/MENTOR) get everything.
  const canEdit = Boolean(session.user.role && canMutate(session.user.role));
  const replies = await listReplies(supportIssue.id, canEdit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard/issues" className="text-sm text-primary hover:underline">
            ← Back to Issues
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{supportIssue.title}</h1>
            <StatusBadge status={supportIssue.status} />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {supportIssue.studentName}
            {supportIssue.studentEmail ? ` · ${supportIssue.studentEmail}` : ""}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-4 font-semibold dark:border-slate-700">Problem Description</div>
        <div className="space-y-4 p-6">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">{supportIssue.question}</p>
          <div className="flex flex-wrap gap-2">
            {supportIssue.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                {tag}
              </span>
            ))}
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <Info label="Course" value={supportIssue.courseSlug} />
            <Info label="Batch" value={supportIssue.batchNo?.toString()} />
            <Info label="Priority" value={supportIssue.priority} />
          </div>
        </div>
      </section>

      {canEdit && (
        <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-4 font-semibold dark:border-slate-700">Status Update</div>
          <div className="p-6">
            <form action={changeIssueStatusActionSimple.bind(null, supportIssue.id)} className="flex flex-col gap-3 sm:flex-row">
              <select
                name="status"
                defaultValue={supportIssue.status}
                className={nativeSelectClass}
              >
                {CASE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
              >
                Update
              </button>
            </form>
          </div>
        </section>
      )}

      {canEdit && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Edit Issue</h2>
          <IssueForm
            supportIssue={{
              id: supportIssue.id,
              title: supportIssue.title,
              question: supportIssue.question,
              status: supportIssue.status,
              priority: supportIssue.priority ?? "NORMAL",
              courseSlug: supportIssue.courseSlug ?? undefined,
              batchNo: supportIssue.batchNo ?? undefined,
              moduleSlug: supportIssue.moduleSlug ?? undefined,
              contentSlug: supportIssue.contentSlug ?? undefined,
              tags: supportIssue.tags,
              studentName: supportIssue.studentName,
              studentEmail: supportIssue.studentEmail ?? undefined,
              lmsUserId: supportIssue.lmsUserId ?? undefined,
            }}
          />
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-4 font-semibold dark:border-slate-700">Replies & Internal Notes</div>
        <div className="space-y-4 p-6">
          {canEdit && <ReplyComposer issueId={supportIssue.id} />}
          <IssueTimeline
            issueId={supportIssue.id}
            replies={replies}
            viewerId={session.user.id}
            viewerRole={session.user.role}
          />
        </div>
      </section>

      {canEdit && (
        <form action={deleteIssueActionSimple.bind(null, supportIssue.id)}>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-danger-100 px-4 py-2 text-sm font-semibold text-danger-700 transition hover:bg-danger-200 dark:bg-danger-950/50 dark:text-danger-200 dark:hover:bg-danger-900/60"
          >
            Archive Issue
          </button>
        </form>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-slate-500 dark:text-slate-400">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}