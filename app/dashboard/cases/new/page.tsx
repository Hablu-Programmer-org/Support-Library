import Link from "next/link";

import { CaseForm } from "@/components/cases/case-form";
import { requireMentorOrAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function NewCasePage() {
  await requireMentorOrAdmin();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/cases" className="text-sm text-primary hover:underline">
          ← Back to Cases
        </Link>
        <h1 className="mt-2 text-2xl font-bold">New Support Case</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Required: student email, title, question. Status defaults to OPEN; solution optional.
        </p>
      </div>
      <CaseForm minimal />
    </div>
  );
}
