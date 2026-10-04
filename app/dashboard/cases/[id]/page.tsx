import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { changeCaseStatusAction, deleteCaseAction } from "@/actions/cases";
import { CaseForm } from "@/components/cases/case-form";
import { CaseTimeline } from "@/components/cases/case-timeline";
import { LinkSolutionPanel } from "@/components/cases/link-solution-panel";
import { ReplyComposer } from "@/components/cases/reply-composer";
import { StatusBadge } from "@/components/cases/status-badge";
import { requireSession } from "@/lib/auth-guard";
import { canMutate } from "@/lib/roles";
import { getCaseDetail } from "@/lib/services/cases";
import { listSolutionsForCase } from "@/lib/services/links";
import { listReplies } from "@/lib/services/replies";
import { listSolutions } from "@/lib/services/solutions";
import { listStudents } from "@/lib/services/students";
import { CASE_STATUSES } from "@/models";

export const dynamic = "force-dynamic";

const statusLabels = {
  OPEN: "ওপেন",
  SOLVED: "সলভড",
  PENDING: "পেন্ডিং",
  FOLLOW_UP: "ফলো-আপ",
  ARCHIVED: "আর্কাইভড",
};

export default async function CaseDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const supportCase = await getCaseDetail(params.id);
  if (!supportCase) notFound();

  const replies = await listReplies(supportCase.id);
  const students = await listStudents({ limit: 100 });
  const linkedSolutions = await listSolutionsForCase(supportCase.id);
  const allSolutions = await listSolutions({ limit: 100 });
  const canEdit = Boolean(session.user.role && canMutate(session.user.role));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard/cases" className="text-sm text-primary hover:underline">
            ← কেস লিস্টে ফিরে যান
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold">{supportCase.title}</h1>
            <StatusBadge status={supportCase.status} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <Link href={`/dashboard/students/${supportCase.studentRefId}`} className="text-primary hover:underline">
              {supportCase.studentName ?? "Student"}
            </Link>
            {supportCase.studentId ? ` · ${supportCase.studentId}` : ""}
          </p>
        </div>
      </div>

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="font-semibold">সমস্যার বিস্তারিত</CardHeader>
        <CardBody className="space-y-4">
          <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700 dark:text-gray-200">{supportCase.question}</p>
          <div className="flex flex-wrap gap-2">
            {supportCase.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-gray-100 px-2 py-1 text-xs dark:bg-gray-800">
                {tag}
              </span>
            ))}
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-3">
            <Info label="Course" value={supportCase.courseSlug} />
            <Info label="Batch" value={supportCase.batchNo?.toString()} />
            <Info label="Priority" value={supportCase.priority} />
          </div>
        </CardBody>
      </Card>

      {canEdit && (
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="font-semibold">Status Update</CardHeader>
          <CardBody>
            <form action={changeCaseStatusAction.bind(null, supportCase.id)} className="flex flex-col gap-3 sm:flex-row">
              <select
                name="status"
                defaultValue={supportCase.status}
                className="rounded-xl border border-gray-300 bg-white px-3 py-3 text-sm outline-none focus:border-primary dark:border-gray-700 dark:bg-gray-900"
              >
                {CASE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
              <Button type="submit" color="primary" variant="flat">
                আপডেট
              </Button>
            </form>
          </CardBody>
        </Card>
      )}

      {canEdit && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">কেস এডিট</h2>
          <CaseForm students={students.items} supportCase={supportCase} />
        </section>
      )}

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="font-semibold">Replies & Internal Notes</CardHeader>
        <CardBody className="space-y-4">
          {canEdit && <ReplyComposer caseId={supportCase.id} />}
          <CaseTimeline caseId={supportCase.id} replies={replies} canMutate={canEdit} />
        </CardBody>
      </Card>

      <LinkSolutionPanel
        caseId={supportCase.id}
        linkedSolutions={linkedSolutions}
        allSolutions={allSolutions.items}
        canMutate={canEdit}
      />

      {canEdit && (
        <form action={deleteCaseAction.bind(null, supportCase.id)}>
          <Button type="submit" color="danger" variant="flat">
            কেস আর্কাইভ করুন
          </Button>
        </form>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-gray-500 dark:text-gray-400">{label}</div>
      <div className="font-medium">{value || "—"}</div>
    </div>
  );
}
