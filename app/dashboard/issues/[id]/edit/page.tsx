import { notFound } from "next/navigation";

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
    <div className="w-full">
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
            mimeType: upload.mimeType,
            width: upload.width,
            height: upload.height,
          })),
          updatedAt: supportIssue.updatedAt?.toISOString(),
        }}
        csrfToken={csrfToken}
        returnTo={returnTo ?? undefined}
        backHref={buildIssueDetailHref(supportIssue.id, returnTo)}
        isPublished={supportIssue.visibility === "PUBLISHED"}
      />
    </div>
  );
}
