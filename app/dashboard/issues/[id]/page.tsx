import { notFound } from "next/navigation";
import type { ComponentProps } from "react";

import {
  deleteIssueAction,
} from "@/actions/issues";
import { IssueDetailHeader } from "@/components/issues/issue-detail-header";
import { IssueDetailSidebar } from "@/components/issues/issue-detail-sidebar";
import { StudentRequestView } from "@/components/issues/student-request-view";
import { IssueProblemSection } from "@/components/issues/issue-problem-section";
import { IssueThread } from "@/components/issues/issue-thread";
import { ReplyComposer } from "@/components/issues/reply-composer";
import { IssueNextStep } from "@/components/issues/issue-next-step";
import { requireSession } from "@/lib/auth-guard";
import { currentShift } from "@/lib/config/live-support";
import { lastStaffReplyDate, pickSolutionReplyId, replyAnchorId } from "@/lib/issue-solution";
import { isLiveSupportConfigured } from "@/lib/live-support";
import { listCourseNames } from "@/lib/lms";
import { liveSupportNow } from "@/lib/live-support-status";
import {
  ISSUES_PATH,
  buildIssueEditHref,
  parseIssueListReturnTo,
} from "@/lib/issue-list-params";
import { canCreateIssue, canMutate, isAdmin } from "@/lib/roles";
import { getOwnIssueActivitySnapshot } from "@/lib/services/issue-activity";
import { getIssueDetail, getOwnIssueDetail, getPublishedIssueDetail } from "@/lib/services/issues";
import { getIssueStudentAccount } from "@/lib/services/issue-student-account";
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

  const [replies, csrfToken, courseNames, studentAccount] = await Promise.all([
    listReplies(supportIssue.id, { viewer: canEdit ? "staff" : "public" }),
    generateCsrfToken(session.user.id),
    canEdit ? Promise.resolve(null) : listCourseNames(),
    staffIssue
      ? getIssueStudentAccount(staffIssue.id, staffIssue.studentEmail)
      : Promise.resolve(null),
  ]);
  const solutionReplyId = pickSolutionReplyId(supportIssue.status, replies);
  // Readers get the course in the header meta line (no context card) and the
  // last answer date instead of "Updated" (see `IssueDetailHeader`).
  const readerCourseLabel = canEdit
    ? null
    : [
        supportIssue.courseSlug
          ? (courseNames?.get(supportIssue.courseSlug) ?? supportIssue.courseSlug)
          : null,
        supportIssue.batchNo ? `Batch ${supportIssue.batchNo}` : null,
      ]
        .filter(Boolean)
        .join(" · ");
  // A student reading someone else's published answer gets a way forward at
  // the end; staff already have the composer there.
  const showNextStep = !canEdit && canCreateIssue(session.user.role);

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

  const sidebarProps = {
    issueId: supportIssue.id,
    status: supportIssue.status,
    isPublished: supportIssue.visibility === "PUBLISHED",
    updatedAtIso: supportIssue.updatedAt?.toISOString() ?? "",
    caseRef: supportIssue.caseRef,
    courseSlug: supportIssue.courseSlug,
    batchNo: supportIssue.batchNo,
    publishedAt: supportIssue.publishedAt,
    csrfToken,
    returnTo: returnTo ?? undefined,
    canEdit,
    canPublish,
    reader: !canEdit,
    staff: staffIssue
      ? {
          ...staffIssue,
          studentEmail: studentAccount?.email ?? null,
          studentImage: studentAccount?.image ?? null,
        }
      : null,
    statusOptions: CASE_STATUSES.filter((status) => status !== "ARCHIVED").map((status) => ({
      value: status,
      label: statusLabels[status],
    })),
    archiveAction: deleteIssueAction.bind(null, supportIssue.id),
  } satisfies ComponentProps<typeof IssueDetailSidebar>;

  return (
    // Same width as the issue list: `PageContainer` already caps it at
    // max-w-screen-2xl, so the page adds no narrower max-width of its own.
    <div className="w-full pt-2 pb-6 sm:pt-6">
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
        // Priority and the library chip are triage data; a library reader
        // only needs the status (see the sidebar's `reader`).
        showPriority={canEdit}
        showLibraryChip={canEdit}
        editHref={canEdit ? buildIssueEditHref(supportIssue.id, returnTo) : undefined}
        aiPrompt={aiPrompt}
        lastAnswerAt={canEdit ? undefined : lastStaffReplyDate(replies)}
        courseLabel={readerCourseLabel}
        solutionHref={solutionReplyId ? `#${replyAnchorId(solutionReplyId)}` : undefined}
      />

      {canEdit ? (
          // DOM order is the phone order: Student snapshot, Issue context and
          // Manage, the case, then the danger zone. On desktop the grid moves
          // both sidebar parts into the right column.
          <div className="grid items-start gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-x-10">
            <IssueDetailSidebar
              part="top"
              className="lg:col-start-2 lg:row-start-1"
              {...sidebarProps}
            />

            <main className="min-w-0 space-y-8 lg:space-y-10 lg:col-start-1 lg:row-span-2 lg:row-start-1">
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
                canEdit
              />

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900/70">
                {/* A new reply remounts it, so the sent response leaves the editor. */}
                <ReplyComposer
                  key={replies.length}
                  issueId={supportIssue.id}
                  csrfToken={csrfToken}
                  returnTo={returnTo ?? undefined}
                />
              </div>
            </main>

            <IssueDetailSidebar
              part="bottom"
              className="lg:col-start-2 lg:row-start-2 lg:self-start"
              {...sidebarProps}
            />
          </div>
      ) : (
        // Library reader: the same full-width grid as the staff and owner
        // views (owner, 2026-11-23: a capped column left the page visibly
        // narrower than the list), with the way forward beside it, sticky on
        // desktop. On a phone it follows the answer, in DOM order.
        <div className="grid items-start gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-x-10">
          <main className="min-w-0 space-y-8 lg:space-y-10">
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
              canEdit={false}
            />
          </main>
          {showNextStep && (
            <IssueNextStep
              stacked
              className="lg:sticky lg:top-20"
              join={{
                csrfToken,
                shift: currentShift(new Date()),
                configured: isLiveSupportConfigured(),
              }}
              liveSupportStatus={
                isLiveSupportConfigured()
                  ? `${liveSupportNow(new Date()).label}.`
                  : "Live support is unavailable right now."
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
