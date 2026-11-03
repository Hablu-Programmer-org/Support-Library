import Link from "next/link";

import { MyRequestsRefresh } from "@/components/issues/my-requests-refresh";
import { StatusBadge } from "@/components/issues/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth-guard";
import { currentShift, SUPPORT_TIME_ZONE } from "@/lib/config/live-support";
import { LIVE_SUPPORT_ELIGIBLE_STATUSES } from "@/lib/constants";
import { getOwnIssueActivitySnapshot } from "@/lib/services/issue-activity";
import { listOwnIssues } from "@/lib/services/issues";

export const dynamic = "force-dynamic";

const timestamp = (date?: Date | null) =>
  date
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: SUPPORT_TIME_ZONE,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)
    : "—";

/**
 * The student's own support requests.
 *
 * Scoped by `createdBy` from the session, so it can never list another student's
 * case. It is the way back to a request (and therefore to live support) after
 * leaving the request page.
 */
export default async function MyRequestsPage() {
  const session = await requireSession();
  const issues = await listOwnIssues(session.user.id);
  const roomOpen = currentShift(new Date()) !== "off";
  // Only students have the scoped endpoint; a staff account opening this page
  // still sees the list, just without the auto-refresh probe.
  const activity =
    session.user.role === "STUDENT"
      ? await getOwnIssueActivitySnapshot(session.user.id)
      : null;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 py-6">
      <PageHeader
        action={
          <div className="flex flex-wrap items-end gap-2">
            {activity && <MyRequestsRefresh initialRevision={activity.revision} />}
            <Link
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
              href="/dashboard/issues/new"
            >
              Submit a request
            </Link>
          </div>
        }
        description="Every request you have submitted, newest first. Open one to join live support for it."
        title="My requests"
      />

      <section className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {issues.length === 0 ? (
          <EmptyState>You have not submitted a request yet.</EmptyState>
        ) : (
          issues.map((issue) => {
            const eligible = (LIVE_SUPPORT_ELIGIBLE_STATUSES as readonly string[]).includes(
              issue.status,
            );
            // "Team replied", not "New": the app keeps no read receipt, so an
            // unread claim would stay on screen after the answer was read. Any
            // staff reply at all is a fact the row can state honestly.
            const teamReplied = Boolean(issue.lastStaffReplyAt);

            return (
              <Link
                key={issue.id}
                className={`flex flex-col gap-2 border-l-4 px-4 py-4 transition sm:flex-row sm:items-center sm:justify-between ${
                  teamReplied
                    ? "border-cyan-500 bg-cyan-50/60 hover:bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-950/20 dark:hover:bg-cyan-950/30"
                    : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60"
                }`}
                href={`/dashboard/issues/${issue.id}`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="line-clamp-2 wrap-break-word font-semibold text-slate-900 dark:text-white">{issue.title}</h2>
                    <StatusBadge status={issue.status} />
                    {teamReplied && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-cyan-100 px-2 py-0.5 text-xs font-semibold text-cyan-700 dark:bg-cyan-950/60 dark:text-cyan-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-cyan-500" aria-hidden="true" />
                        Team replied
                      </span>
                    )}
                    {roomOpen && eligible && (
                      <span className="rounded-full bg-success-100 px-2 py-0.5 text-xs font-semibold text-success-700 dark:bg-success-950/50 dark:text-success-300">
                        Live now
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {issue.caseRef ? (
                      <span className="select-all font-mono font-semibold">{issue.caseRef}</span>
                    ) : (
                      <span aria-hidden="true">—</span>
                    )}{" "}
                    · {teamReplied ? "Replied" : "Updated"}{" "}
                    {timestamp(teamReplied ? issue.lastStaffReplyAt : issue.updatedAt)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-primary">
                  {teamReplied ? "View reply →" : "Open"}
                </span>
              </Link>
            );
          })
        )}
      </section>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        The team replies by email as well, and every update also appears on the request page.
      </p>
    </div>
  );
}
