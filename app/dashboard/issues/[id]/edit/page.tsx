import { notFound, redirect } from "next/navigation";

import { IssueForm } from "@/components/issues/issue-form";
import { requireMentorOrAdmin } from "@/lib/auth-guard";
import {
  buildIssueDetailHref,
  buildIssueEditHref,
  parseIssueListReturnTo,
} from "@/lib/issue-list-params";
import { issueUrlKey } from "@/lib/issue-ref";
import { getIssueDetail, resolveIssueIdFromParam } from "@/lib/services/issues";
import { generateCsrfToken } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export default async function EditIssuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  const { id: param } = await params;
  const { returnTo: rawReturnTo } = (await searchParams) ?? {};
  const session = await requireMentorOrAdmin();
  const id = await resolveIssueIdFromParam(param);
  const supportIssue = id ? await getIssueDetail(id) : null;
  if (!supportIssue) notFound();
  // Only staff reach this page, so the mentor filter is legitimate here.
  const returnTo = parseIssueListReturnTo(rawReturnTo, { canManage: true });
  // Staff-only page, so the role check above is the access check: an old `_id`
  // URL can move to the reference URL now (307, never cached).
  if (issueUrlKey(supportIssue) !== param) redirect(buildIssueEditHref(supportIssue, returnTo));
  const csrfToken = await generateCsrfToken(session.user.id);

  return (
    <div className="w-full">
      <IssueForm
        supportIssue={{
          id: supportIssue.id,
          caseRef: supportIssue.caseRef,
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
        backHref={buildIssueDetailHref(supportIssue, returnTo)}
        isPublished={supportIssue.visibility === "PUBLISHED"}
      />
    </div>
  );
}
