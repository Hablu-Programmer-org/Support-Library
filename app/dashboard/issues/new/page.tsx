import Link from "next/link";

import { IssueForm } from "@/components/issues/issue-form";
import { requireMentorOrAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function NewIssuePage() {
  await requireMentorOrAdmin();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/issues" className="text-sm text-primary hover:underline">
          ← Back to Issues
        </Link>
        <h1 className="mt-2 text-2xl font-bold">New Support Issue</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Required: student email, title, question. Status defaults to OPEN; solution optional.
        </p>
      </div>
      <IssueForm minimal />
    </div>
  );
}