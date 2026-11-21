import { notFound } from "next/navigation";

import {
  deleteIssueAction,
} from "@/actions/issues";
import { IssueDetailHeader } from "@/components/issues/issue-detail-header";
import { IssueDetailSidebar } from "@/components/issues/issue-detail-sidebar";
import { StudentRequestView } from "@/components/issues/student-request-view";
import { IssueProblemSection } from "@/components/issues/issue-problem-section";
import { IssueThread } from "@/components/issues/issue-thread";
import { ReplyComposer } from "@/components/issues/reply-composer";
import { requireSession } from "@/lib/auth-guard";
import {
  ISSUES_PATH,
  buildIssueEditHref,
  parseIssueListReturnTo,
} from "@/lib/issue-list-params";
import { canMutate, isAdmin } from "@/lib/roles";
import { getOwnIssueActivitySnapshot } from "@/lib/services/issue-activity";
import { getIssueDetail, getOwnIssueDetail, getPublishedIssueDetail } from "@/lib/services/issues";
import { listReplies } from "@/lib/services/replies";
import { CASE_STATUSES } from "@/models";
import { generateCsrfToken } from "@/lib/csrf";
import { buildIssueResponsePrompt } from "@/lib/issue-response-prompt";

export const dynamic = "force-dynamic";

const statusLabels = {
  OPEN: "Open",
  SOLVED: "Solved",
  PENDING: "Pending",
  AWAITING_STUDENT: "Needs your reply",
  FOLLOW_UP: "Follow-up",
  ARCHIVED: "Archived",
};

export default async function IssueDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ created?: string; returnTo?: string }>;
}) {
  const { id } = await params;
  const { created, returnTo: rawReturnTo } = (await searchParams) ?? {};
  const session = await requireSession();
  const canEdit = Boolean(session.user.role && canMutate(session.user.role));
  const canPublish = isAdmin(session.user.role ?? "STUDENT");
  // The list URL the viewer arrived from (filters + page), validated and rebuilt
  // server-side. `null` means "no list context" — a direct link, a bookmark or a
  // dashboard-home row — and the back link falls back to the plain list.
  const returnTo = parseIssueListReturnTo(rawReturnTo, { canManage: canEdit });
  const backHref = returnTo ?? ISSUES_PATH;
  const backLabel =
    returnTo === "/dashboard"
      ? "Back to dashboard"
      : returnTo
        ? "Back to results"
        : "Back to Issues";
  const staffIssue = canEdit ? await getIssueDetail(id) : null;

  if (!staffIssue) {
    // A student may read their own request whatever its visibility. Anyone else
    // still falls through to the published library or a 404, so an unpublished
    // case never opens up. Ownership comes from `createdBy`, not the URL.
    const ownedIssue = await getOwnIssueDetail(id, session.user.id);
    if (ownedIssue) {
      const [replies, csrfToken, activity] = await Promise.all([
        listReplies(ownedIssue.id, { viewerId: session.user.id ?? undefined, viewer: "owner" }),
        generateCsrfToken(session.user.id),
        getOwnIssueActivitySnapshot(session.user.id),
      ]);

      return (
        <StudentRequestView
          activityRevision={activity.revision}
          created={created === "1"}
          csrfToken={csrfToken}
          issue={ownedIssue}
          replies={replies}
          viewerId={session.user.id}
        />
      );
    }
  }

  const supportIssue = staffIssue ?? (await getPublishedIssueDetail(id));
  if (!supportIssue) notFound();

  const replies = await listReplies(supportIssue.id, {
    viewer: canEdit ? "staff" : "public",
  });
  const csrfToken = await generateCsrfToken(session.user.id);

  // Admin-only: the prompt carries the full thread, which mentors can read but
  // only admins may hand to an external assistant. It is built from an explicit
  // allowlist on the server, never scraped from the rendered page, and contains
  // no student identity, internal ids or private attachment URLs.
  const aiPrompt =
    canPublish && staffIssue
      ? buildIssueResponsePrompt({
          issue: {
            title: staffIssue.title,
            question: staffIssue.question,
            status: staffIssue.status,
            priority: staffIssue.priority,
            courseSlug: staffIssue.courseSlug,
            batchNo: staffIssue.batchNo,
            moduleSlug: staffIssue.moduleSlug,
            contentSlug: staffIssue.contentSlug,
            tags: staffIssue.tags,
            createdAt: staffIssue.createdAt,
            updatedAt: staffIssue.updatedAt,
            videoLinks: staffIssue.videoLinks,
            attachments: staffIssue.uploads.map((upload) => ({
              mimeType: upload.mimeType,
            })),
          },
          replies: replies.map((reply) => ({
            isStaffReply: reply.isStaffReply,
            body: reply.body,
            createdAt: reply.createdAt,
            videoLinks: reply.videoLinks,
            attachments: reply.uploads.map((upload) => ({ mimeType: upload.mimeType })),
          })),
        })
      : null;

  return (
    // Same width as the issue list: `PageContainer` already caps it at
    // max-w-screen-2xl, so the page adds no narrower max-width of its own.
    <div className="w-full py-6">
      <IssueDetailHeader
        title={supportIssue.title}
        status={supportIssue.status}
        priority={supportIssue.priority}
        isPublished={supportIssue.visibility === "PUBLISHED"}
        createdAt={supportIssue.createdAt}
        updatedAt={supportIssue.updatedAt}
        backHref={backHref}
        backLabel={backLabel}
        canEdit={canEdit}
        editHref={canEdit ? buildIssueEditHref(supportIssue.id, returnTo) : undefined}
        aiPrompt={aiPrompt}
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10">
        <main className="min-w-0 space-y-10">
          <IssueProblemSection
            question={supportIssue.question}
            videoLinks={supportIssue.videoLinks ?? []}
            uploads={supportIssue.uploads ?? []}
            tags={supportIssue.tags ?? []}
          />

          <IssueThread
            issueId={supportIssue.id}
            status={supportIssue.status}
            replies={replies}
            viewerId={session.user.id}
            viewerRole={session.user.role}
            csrfToken={csrfToken}
            canEdit={canEdit}
          />

          {canEdit && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900/70">
              <ReplyComposer
                issueId={supportIssue.id}
                csrfToken={csrfToken}
                returnTo={returnTo ?? undefined}
              />
            </div>
          )}
        </main>

        <IssueDetailSidebar
          issueId={supportIssue.id}
          status={supportIssue.status}
          isPublished={supportIssue.visibility === "PUBLISHED"}
          updatedAtIso={supportIssue.updatedAt?.toISOString() ?? ""}
          caseRef={supportIssue.caseRef}
          courseSlug={supportIssue.courseSlug}
          batchNo={supportIssue.batchNo}
          publishedAt={supportIssue.publishedAt}
          csrfToken={csrfToken}
          returnTo={returnTo ?? undefined}
          canEdit={canEdit}
          canPublish={canPublish}
          staff={staffIssue}
          statusOptions={CASE_STATUSES.filter((status) => status !== "ARCHIVED").map(
            (status) => ({ value: status, label: statusLabels[status] }),
          )}
          archiveAction={deleteIssueAction.bind(null, supportIssue.id)}
        />
      </div>
    </div>
  );
}
