import Link from "next/link";

import { ArrowLeftIcon } from "@/components/icons";
import { LiveSupportPanel } from "@/components/live-support/live-support-panel";
import { StatusBadge } from "@/components/issues/status-badge";
import { AttachmentList } from "@/components/shared/attachment-list";
import { CopyValue } from "@/components/shared/copy-value";
import { LinkList } from "@/components/shared/link-list";
import { currentShift, SUPPORT_TIME_ZONE } from "@/lib/config/live-support";
import { getLiveSupportConfig } from "@/lib/live-support";
import type { SupportIssueListItem } from "@/lib/services/issues";
import type { SupportReplyListItem } from "@/lib/services/replies";

const timestamp = (date?: Date | null) =>
  date
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: SUPPORT_TIME_ZONE,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)
    : "—";

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
}: {
  issue: SupportIssueListItem;
  replies: SupportReplyListItem[];
  csrfToken: string;
  created: boolean;
}) {
  const shift = currentShift(new Date());
  const { platform, meetingId, passcode } = getLiveSupportConfig();
  const roomOpen = shift !== "off";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 py-6">
      <Link
        href="/dashboard/my-requests"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary transition hover:text-primary-600 hover:underline"
      >
        <ArrowLeftIcon size={18} />
        Back to my requests
      </Link>

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
          <span>Submitted {timestamp(issue.createdAt)}</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          {issue.title}
        </h1>
      </header>

      <section aria-labelledby="request-problem-heading" className="space-y-2">
        <h2
          id="request-problem-heading"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Your problem
        </h2>
        <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
          {issue.question}
        </p>
        <LinkList videoLinks={issue.videoLinks} />
        <AttachmentList uploads={issue.uploads} />
      </section>

      <section aria-labelledby="request-details-heading">
        <h2
          id="request-details-heading"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Details
        </h2>
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
            <dd className="text-slate-900 dark:text-white">{timestamp(issue.updatedAt)}</dd>
          </div>
        </dl>
      </section>

      <section aria-labelledby="request-updates-heading">
        <h2
          id="request-updates-heading"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Updates from the team
        </h2>
        {replies.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            No updates yet. The team answers by email as well, so check your inbox.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-200 border-t border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {replies.map((reply) => (
              <li key={reply.id} className="space-y-1 py-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {reply.authorName ?? "Support team"} · {timestamp(reply.createdAt)}
                </p>
                <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                  {reply.body}
                </p>
                <LinkList videoLinks={reply.videoLinks} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <LiveSupportPanel
        csrfToken={csrfToken}
        issueId={issue.id}
        meetingId={roomOpen ? meetingId : undefined}
        passcode={roomOpen ? passcode : undefined}
        platform={platform}
        shift={shift}
        status={issue.status}
      />

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Replies here are read-only. Try the course documentation and videos first — the team helps
        much faster when you share what you already tried.
      </p>
    </div>
  );
}
