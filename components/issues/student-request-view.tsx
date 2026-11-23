import { LiveSupportPanel } from "@/components/live-support/live-support-panel";
import { IssueDetailHeader } from "@/components/issues/issue-detail-header";
import { IssueDetailSidebar } from "@/components/issues/issue-detail-sidebar";
import { IssueProblemSection } from "@/components/issues/issue-problem-section";
import { IssueThread } from "@/components/issues/issue-thread";
import { MyRequestsRefresh } from "@/components/issues/my-requests-refresh";
import { StudentReplyComposer } from "@/components/issues/student-reply-composer";
import { currentShift } from "@/lib/config/live-support";
import { getLiveSupportConfig } from "@/lib/live-support";
import type { OwnIssueDetail } from "@/lib/services/issues";
import type { SupportReplyListItem } from "@/lib/services/replies";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900/70";
const note =
  "rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400";

/**
 * A student's own support request, in the same layout as the staff and library
 * case pages (header, Issue details, Responses, Issue context sidebar).
 *
 * This is the only place a student sees an unpublished case, so it shows exactly
 * what they submitted plus the team's answers — never the internal snapshot
 * (student email, mentor tools, publication history, audit). Which replies
 * appear is decided server-side (`viewer: "owner"`); staff answers carry the
 * mentor's name, the student's own follow-ups read "You".
 *
 * The live support panel is scoped to this request, which is what makes "join
 * with the request you submitted" the only available path: there is no picker
 * and no room on any page without an owned request.
 */
export function StudentRequestView({
  issue,
  replies,
  csrfToken,
  created,
  activityRevision,
  viewerId,
}: {
  issue: OwnIssueDetail;
  replies: SupportReplyListItem[];
  csrfToken: string;
  created: boolean;
  /** Student-scoped revision from the server render; a changed one pulls a new reply in. */
  activityRevision: string;
  viewerId: string;
}) {
  const shift = currentShift(new Date());
  const { platform, meetingId, passcode, joinUrl } = getLiveSupportConfig();
  const roomOpen = shift !== "off";
  const archived = issue.status === "ARCHIVED";
  const teamReplied = replies.some((reply) => reply.isStaffReply);

  return (
    <div className="w-full pt-2 pb-6 sm:pt-6">
      <IssueDetailHeader
        title={issue.title}
        status={issue.status}
        statusViewer="owner"
        showPriority={false}
        isPublished={issue.visibility === "PUBLISHED"}
        createdAt={issue.createdAt}
        updatedAt={issue.updatedAt}
        backHref="/dashboard/my-issues"
        backLabel="Back to my issues"
        // The open request stays current while the student waits: a staff reply
        // bumps the student's revision and this refreshes the RSC payload.
        backAside={<MyRequestsRefresh initialRevision={activityRevision} />}
        canEdit={false}
      />

      {created && (
        <div
          role="status"
          className="mb-8 rounded-2xl border border-emerald-300 bg-emerald-50 px-5 py-4 text-sm dark:border-emerald-500/30 dark:bg-emerald-500/10"
        >
          <p className="font-semibold text-emerald-800 dark:text-emerald-200">
            Your issue has been submitted.
          </p>
          <p className="mt-1 text-slate-700 dark:text-slate-300">
            The support team has it now and will reply by email. You can join live support for this
            issue while the room is open.
          </p>
        </div>
      )}

      <div className="grid items-start gap-6 lg:gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10">
        <main className="min-w-0 space-y-10">
          <IssueProblemSection
            question={issue.question}
            uploads={issue.uploads ?? []}
            tags={issue.tags ?? []}
          />

          <IssueThread
            issueId={issue.id}
            status={issue.status}
            replies={replies}
            viewerId={viewerId}
            viewerRole="STUDENT"
            csrfToken={csrfToken}
            canEdit={false}
            ownerView
          />

          {archived ? (
            <p className={note}>This request is archived, so follow-up replies are closed.</p>
          ) : teamReplied ? (
            <div className={card}>
              {/* A new reply remounts it, so the sent message leaves the editor. */}
              <StudentReplyComposer key={replies.length} issueId={issue.id} csrfToken={csrfToken} />
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Follow-ups are sent to the support team and may reopen a solved request.
              </p>
            </div>
          ) : (
            <p className={note}>
              Wait for the support team&apos;s first reply before sending a follow-up.
            </p>
          )}
        </main>

        <IssueDetailSidebar
          issueId={issue.id}
          status={issue.status}
          isPublished={issue.visibility === "PUBLISHED"}
          updatedAtIso={issue.updatedAt?.toISOString() ?? ""}
          caseRef={issue.caseRef}
          courseSlug={issue.courseSlug}
          batchNo={issue.batchNo}
          publishedAt={issue.publishedAt}
          csrfToken={csrfToken}
          canEdit={false}
          canPublish={false}
        >
          <LiveSupportPanel
            caseRef={issue.caseRef}
            configured={Boolean(joinUrl)}
            csrfToken={csrfToken}
            issueId={issue.id}
            meetingId={roomOpen ? meetingId : null}
            passcode={roomOpen ? passcode : null}
            platform={platform}
            shift={shift}
            status={issue.status}
          />
        </IssueDetailSidebar>
      </div>
    </div>
  );
}
