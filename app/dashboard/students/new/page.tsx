import Link from "next/link";

import { StudentForm } from "@/components/students/student-form";
import { requireMentorOrAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function NewStudentPage() {
  await requireMentorOrAdmin();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/students" className="text-sm text-primary hover:underline">
          ← স্টুডেন্ট লিস্টে ফিরে যান
        </Link>
        <h1 className="mt-2 text-2xl font-bold">নতুন স্টুডেন্ট</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          নাম required. Student ID, email, phone বা LMS ID থাকলে add করুন।
        </p>
      </div>
      <StudentForm />
    </div>
  );
}
