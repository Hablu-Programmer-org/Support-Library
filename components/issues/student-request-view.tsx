import Link from "next/link";

import { ArrowLeftIcon } from "@/components/icons";
import { LiveSupportPanel } from "@/components/live-support/live-support-panel";
import { MyRequestsRefresh } from "@/components/issues/my-requests-refresh";
import { ReplyItem } from "@/components/issues/reply-item";
import { StudentReplyComposer } from "@/components/issues/student-reply-composer";
import { StatusBadge } from "@/components/issues/status-badge";
import { AttachmentList } from "@/components/shared/attachment-list";
import { CopyValue } from "@/components/shared/copy-value";
import { LinkList } from "@/components/shared/link-list";
import { SectionLabel } from "@/components/shared/section-label";
import { currentShift } from "@/lib/config/live-support";
import { formatSupportDate } from "@/lib/format-date";
import { getLiveSupportConfig } from "@/lib/live-support";
import type { SupportIssueListItem } from "@/lib/services/issues";
import type { SupportReplyListItem } from "@/lib/services/replies";

/**
 * A student's own support request.
 *
 * This is the only place a student sees an unpublished case, so it shows exactly
 * what they submitted plus the team's public replies — never the internal
 * snapshot (staff email fields, mentor, publication history, audit), and never
 * attachments staff added to a reply (the reply projection strips those).
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
}: {
  issue: SupportIssueListItem;
  replies: SupportReplyListItem[];
  csrfToken: string;
  created: boolean;
  /** Student-scoped revision from the server render; a changed one pulls a new reply in. */
  activityRevision: string;
}) {
  const shift = currentShift(new Date());
  const { platform, meetingId, passcode, joinUrl } = getLiveSupportConfig();
  const roomOpen = shift !== "off";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/dashboard/my-requests"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:text-primary-600 hover:underline"
        >
          <ArrowLeftIcon size={18} />
          Back to my requests
        </Link>
        {/* The open request stays current while the student waits: a staff reply
            bumps the student's revision and this refreshes the RSC payload. */}
        <MyRequestsRefresh initialRevision={activityRevision} />
      </div>

      {created && (
        <div
          role="status"
          className="border-l-2 border-success-500 pl-4 text-sm text-success-700 dark:text-success-300"
        >
          <p className="font-semibold">Your request has been submitted.</p>
          <p className="text-slate-600 dark:text-slate-300">
            The support team has it now and will reply by email. You can join live support for this
            request while the room is open.
          </p>
        </div>
      )}

      <header className="space-y-3 border-b border-slate-200 pb-6 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <StatusBadge status={issue.status} />
          {issue.caseRef ? (
            <CopyValue label="request reference" value={issue.caseRef} variant="chip" />
          ) : (
            <span aria-hidden="true">—</span>
          )}
          <span>Submitted {formatSupportDate(issue.createdAt)}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          {issue.title}
        </h1>
      </header>

      <section aria-labelledby="request-problem-heading" className="space-y-2">
        <SectionLabel id="request-problem-heading">Problem</SectionLabel>
        <p className="whitespace-pre-wrap text-base leading-7 text-slate-800 dark:text-slate-100">
          {issue.question}
        </p>
        <LinkList videoLinks={issue.videoLinks} />
        <AttachmentList uploads={issue.uploads} />
      </section>

      <section aria-labelledby="request-details-heading">
        <SectionLabel id="request-details-heading">Details</SectionLabel>
        <dl className="mt-3 space-y-3 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">Reference</dt>
            <dd className="font-semibold text-slate-900 dark:text-white">
              {issue.caseRef ? (
                <CopyValue label="request reference" value={issue.caseRef} />
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">Course</dt>
            <dd className="text-slate-900 dark:text-white">{issue.courseSlug ?? "—"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">Batch</dt>
            <dd className="text-slate-900 dark:text-white">{issue.batchNo ?? "—"}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-slate-500 dark:text-slate-400">Last updated</dt>
            <dd className="text-slate-900 dark:text-white">{formatSupportDate(issue.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      {replies.length > 0 ? (
        <>
          <section aria-labelledby="request-answer-heading">
            <SectionLabel id="request-answer-heading">
              {issue.status === "SOLVED" ? "Solution" : "Answer"}
            </SectionLabel>
            <ol className="mt-2">
              <li>
                <ReplyItem
                  issueId={issue.id}
                  reply={replies[0]}
                  canEdit={false}
                  variant="solution"
                  authorLabel={replies[0].isStaffReply ? "Support team" : "You"}
                />
              </li>
            </ol>
          </section>

          {replies.length > 1 && (
            <section aria-labelledby="request-updates-heading">
              <SectionLabel id="request-updates-heading">Updates</SectionLabel>
              <ol className="mt-2">
                {replies.slice(1).map((reply) => (
                  <li key={reply.id}>
                    <ReplyItem
                      issueId={issue.id}
                      reply={reply}
                      canEdit={false}
                      authorLabel={reply.isStaffReply ? "Support team" : "You"}
                    />
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      ) : (
        <section aria-labelledby="request-updates-heading">
          <SectionLabel id="request-updates-heading">Updates</SectionLabel>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            No updates yet. The team answers by email as well, so check your inbox.
          </p>
        </section>
      )}

      {issue.status === "ARCHIVED" ? (
        <p className="border-l-2 border-slate-300 pl-3 text-sm text-slate-500 dark:text-slate-400">
          This request is archived, so follow-up replies are closed.
        </p>
      ) : replies.some((reply) => reply.isStaffReply) ? (
        <StudentReplyComposer issueId={issue.id} csrfToken={csrfToken} />
      ) : (
        <p className="border-l-2 border-slate-300 pl-3 text-sm text-slate-500 dark:text-slate-400">
          Wait for the support team&apos;s first reply before sending a follow-up.
        </p>
      )}

      <LiveSupportPanel
        configured={Boolean(joinUrl)}
        csrfToken={csrfToken}
        issueId={issue.id}
        meetingId={roomOpen ? meetingId : null}
        passcode={roomOpen ? passcode : null}
        platform={platform}
        shift={shift}
        status={issue.status}
      />

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Follow-ups are sent to the support team and may reopen a solved request.
      </p>
    </div>
  );
}
