import Link from "next/link";
import { notFound } from "next/navigation";

import { changeCaseStatusAction, deleteCaseAction } from "@/actions/cases";
import { CaseForm } from "@/components/cases/case-form";
import { CaseTimeline } from "@/components/cases/case-timeline";
import { ReplyComposer } from "@/components/cases/reply-composer";
import { StatusBadge } from "@/components/cases/status-badge";
import { requireSession } from "@/lib/auth-guard";
import { nativeSelectClass } from "@/lib/config/fields";
import { canMutate } from "@/lib/roles";
import { getCaseDetail } from "@/lib/services/cases";
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

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const supportCase = await getCaseDetail(id);
  if (!supportCase) notFound();

  // VIEWER (students) must not see staff-only content: internal notes.
  // Staff (ADMIN/MENTOR) get everything.
  const canEdit = Boolean(session.user.role && canMutate(session.user.role));
  const replies = await listReplies(supportCase.id, canEdit);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard/cases" className="text-sm text-primary hover:underline">
            ← Back to Cases
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{supportCase.title}</h1>
            <StatusBadge status={supportCase.status} />
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {supportCase.studentName}
            {supportCase.studentEmail ? ` · ${supportCase.studentEmail}` : ""}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-4 font-semibold dark:border-slate-700">Problem Description</div>
        <div className="space-y-4 p-6">
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">{supportCase.question}</p>
          <div className="flex flex-wrap gap-2">
            {supportCase.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">
                {tag}
              </span>
            ))}
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <Info label="Course" value={supportCase.courseSlug} />
            <Info label="Batch" value={supportCase.batchNo?.toString()} />
            <Info label="Priority" value={supportCase.priority} />
          </div>
        </div>
      </section>

      {canEdit && (
        <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="border-b border-slate-200 px-6 py-4 font-semibold dark:border-slate-700">Status Update</div>
          <div className="p-6">
            <form action={changeCaseStatusAction.bind(null, supportCase.id)} className="flex flex-col gap-3 sm:flex-row">
              <select
                name="status"
                defaultValue={supportCase.status}
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
          <h2 className="text-lg font-semibold">Edit Case</h2>
          <CaseForm supportCase={supportCase} />
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-4 font-semibold dark:border-slate-700">Replies & Internal Notes</div>
        <div className="space-y-4 p-6">
          {canEdit && <ReplyComposer caseId={supportCase.id} />}
          <CaseTimeline
            caseId={supportCase.id}
            replies={replies}
            viewerId={session.user.id}
            viewerRole={session.user.role}
          />
        </div>
      </section>

      {canEdit && (
        <form action={deleteCaseAction.bind(null, supportCase.id)}>
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-xl bg-danger-100 px-4 py-2 text-sm font-semibold text-danger-700 transition hover:bg-danger-200 dark:bg-danger-950/50 dark:text-danger-200 dark:hover:bg-danger-900/60"
          >
            Archive Case
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
