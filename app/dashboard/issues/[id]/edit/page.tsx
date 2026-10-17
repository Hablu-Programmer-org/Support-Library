import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeftIcon, SettingsIcon } from "@/components/icons";
import { IssueForm } from "@/components/issues/issue-form";
import { requireMentorOrAdmin } from "@/lib/auth-guard";
import { getIssueDetail } from "@/lib/services/issues";
import { generateCsrfToken } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export default async function EditIssuePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireMentorOrAdmin();
  const supportIssue = await getIssueDetail(id);
  if (!supportIssue) notFound();
  const csrfToken = await generateCsrfToken(session.user.id);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <Link
        href={`/dashboard/issues/${supportIssue.id}`}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeftIcon size={18} />
        Back to issue
      </Link>

      <header className="mb-7 flex items-start gap-3">
        <SettingsIcon size={20} className="mt-1.5 shrink-0 text-slate-400 dark:text-slate-500" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-950 dark:text-white">Edit issue</h1>
          <p className="mt-1 text-slate-600 dark:text-slate-400">
            Updating public content will remove it from the Student Library until an admin reviews it again.
          </p>
        </div>
      </header>

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
          videoLinks: supportIssue.videoLinks,
          uploads: supportIssue.uploads.map((upload) => ({
            id: upload.id,
            originalName: upload.originalName,
            byteSize: upload.byteSize,
          })),
          updatedAt: supportIssue.updatedAt?.toISOString(),
        }}
        csrfToken={csrfToken}
      />
    </div>
  );
}
