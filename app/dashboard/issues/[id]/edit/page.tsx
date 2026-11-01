import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeftIcon, SettingsIcon } from "@/components/icons";
import { IssueForm } from "@/components/issues/issue-form";
import { requireMentorOrAdmin } from "@/lib/auth-guard";
import { buildIssueDetailHref, parseIssueListReturnTo } from "@/lib/issue-list-params";
import { getIssueDetail } from "@/lib/services/issues";
import { generateCsrfToken } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export default async function EditIssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo: rawReturnTo } = (await searchParams) ?? {};
  const session = await requireMentorOrAdmin();
  const supportIssue = await getIssueDetail(id);
  if (!supportIssue) notFound();
  // Only staff reach this page, so the mentor filter is legitimate here.
  const returnTo = parseIssueListReturnTo(rawReturnTo, { canManage: true });
  const csrfToken = await generateCsrfToken(session.user.id);

  return (
    <div className="mx-auto w-full max-w-3xl py-6">
      <Link
        href={buildIssueDetailHref(supportIssue.id, returnTo)}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeftIcon size={18} />
        Back to issue
      </Link>

      <header className="mb-7 flex items-start gap-3">
        <SettingsIcon size={20} className="mt-1.5 shrink-0 text-slate-400 dark:text-slate-500" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Edit issue</h1>
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
        returnTo={returnTo ?? undefined}
      />
    </div>
  );
}
