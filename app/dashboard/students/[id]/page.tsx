import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StudentForm } from "@/components/students/student-form";
import { StatusBadge } from "@/components/cases/status-badge";
import { requireSession } from "@/lib/auth-guard";
import { canMutate } from "@/lib/roles";
import { getStudentHistory } from "@/lib/services/students";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const { student, cases } = await getStudentHistory(params.id);
  if (!student) notFound();

  const canEdit = Boolean(session.user.role && canMutate(session.user.role));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link href="/dashboard/students" className="text-sm text-primary hover:underline">
            ← স্টুডেন্ট লিস্টে ফিরে যান
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{student.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {[student.studentId, student.email, student.phone].filter(Boolean).join(" · ") || "যোগাযোগ/আইডি যোগ করা হয়নি"}
          </p>
        </div>
        {canEdit && (
          <Button as={Link} href={`/dashboard/cases/new?studentId=${student.id}`} color="primary">
            নতুন কেস
          </Button>
        )}
      </div>

      <Card className="border border-slate-200 dark:border-slate-700">
        <CardHeader className="font-semibold">স্টুডেন্ট তথ্য</CardHeader>
        <CardBody className="grid gap-3 text-sm sm:grid-cols-2">
          <Info label="স্টুডেন্ট আইডি" value={student.studentId} />
          <Info label="LMS User ID" value={student.lmsUserId} />
          <Info label="ইমেইল" value={student.email} />
          <Info label="ফোন" value={student.phone} />
        </CardBody>
      </Card>

      {canEdit && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">তথ্য আপডেট</h2>
          <StudentForm student={student} />
        </section>
      )}

      <Card className="border border-slate-200 dark:border-slate-700">
        <CardHeader className="font-semibold">কেস হিস্টোরি</CardHeader>
        <CardBody className="p-0">
          {cases.length === 0 ? (
            <div className="p-6 text-sm text-slate-500 dark:text-slate-400">এই স্টুডেন্টের কোনো support case নেই।</div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {cases.map((supportCase) => (
                <Link
                  key={supportCase.id}
                  href={`/dashboard/cases/${supportCase.id}`}
                  className="block p-4 transition hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{supportCase.title}</div>
                      <div className="line-clamp-1 text-sm text-slate-500 dark:text-slate-400">{supportCase.question}</div>
                    </div>
                    <StatusBadge status={supportCase.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
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
