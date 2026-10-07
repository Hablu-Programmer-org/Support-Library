import Link from "next/link";

import { CaseForm } from "@/components/cases/case-form";
import { requireMentorOrAdmin } from "@/lib/auth-guard";
import { listStudents } from "@/lib/services/students";

export const dynamic = "force-dynamic";

export default async function NewCasePage({ searchParams }: { searchParams?: { studentId?: string } }) {
  await requireMentorOrAdmin();
  const students = await listStudents({ limit: 100 });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/cases" className="text-sm text-primary hover:underline">
          ← কেস লিস্টে ফিরে যান
        </Link>
        <h1 className="mt-2 text-2xl font-bold">নতুন সাপোর্ট কেস</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Required: student, title, question, status. বাকিগুলো optional.
        </p>
      </div>
      <CaseForm students={students.items} selectedStudentId={searchParams?.studentId} />
    </div>
  );
}
