import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StudentForm } from "@/components/students/student-form";
import { requireSession } from "@/lib/auth-guard";
import { canMutate } from "@/lib/roles";
import { getStudentHistory } from "@/lib/services/students";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const { student } = await getStudentHistory(params.id);
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
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {[student.studentId, student.email, student.phone].filter(Boolean).join(" · ") || "যোগাযোগ/আইডি যোগ করা হয়নি"}
          </p>
        </div>
        {canEdit && (
          <Button as={Link} href={`/dashboard/cases/new?studentId=${student.id}`} color="primary">
            নতুন কেস
          </Button>
        )}
      </div>

      <Card className="border border-gray-200 dark:border-gray-700">
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

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="font-semibold">কেস হিস্টোরি</CardHeader>
        <CardBody className="text-sm text-gray-500 dark:text-gray-400">
          কেস সার্ভিস তৈরি হলে এই স্টুডেন্টের সব support case এখানে দেখা যাবে।
        </CardBody>
      </Card>
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
