import Link from "next/link";

import { MessageSquareIcon } from "@/components/icons";
import { MyIssueCard } from "@/components/issues/my-issue-card";
import { MyIssuesFilter, myIssuesViewHref } from "@/components/issues/my-issues-filter";
import { MyRequestsRefresh } from "@/components/issues/my-requests-refresh";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth-guard";
import { currentShift } from "@/lib/config/live-support";
import { filterMyIssues, groupMyIssues, parseMyIssuesView } from "@/lib/my-issues-view";
import { getOwnIssueActivitySnapshot } from "@/lib/services/issue-activity";
import { listOwnIssues } from "@/lib/services/issues";

export const dynamic = "force-dynamic";

const NEW_ISSUE_HREF = "/dashboard/issues/new";

// cyan-700 + white (light) and cyan-400 + cyan-950 (dark) both clear 4.5:1;
// the old bg-primary + white did not.
const primaryButtonClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-700 px-4 text-sm font-semibold text-white transition hover:bg-cyan-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:bg-cyan-400 dark:text-cyan-950 dark:hover:bg-cyan-300 dark:focus-visible:ring-offset-slate-950";

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={16}
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth={2.4}
      viewBox="0 0 24 24"
      width={16}
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

/**
 * The student's own support issues.
 *
 * Scoped by `createdBy` from the session, so it can never list another student's
 * case. It is the way back to an issue (and therefore to live support) after
 * leaving the request page.
 */
export default async function MyIssuesPage({
  searchParams,
}: {
  searchParams?: Promise<{ view?: string | string[] }>;
}) {
  const session = await requireSession();
  const issues = await listOwnIssues(session.user.id);
  // Counts and the visible rows come from the same list, so they always agree.
  const view = parseMyIssuesView((await searchParams)?.view);
  const counts = groupMyIssues(issues);
  const visible = filterMyIssues(issues, view);
  const now = new Date();
  const roomOpen = currentShift(now) !== "off";
  // Only students have the scoped endpoint; a staff account opening this page
  // still sees the list, just without the auto-refresh probe.
  const activity =
    session.user.role === "STUDENT"
      ? await getOwnIssueActivitySnapshot(session.user.id)
      : null;

  return (
    // Full shell width, like the Issues list: the shell's PageContainer already
    // caps the line length on very wide screens.
    <div className="w-full space-y-6 py-6">
      <PageHeader
        action={
          <div className="flex flex-wrap items-center gap-2">
            {activity && <MyRequestsRefresh initialRevision={activity.revision} />}
            <Link className={primaryButtonClass} href={NEW_ISSUE_HREF}>
              <PlusIcon />
              New issue
            </Link>
          </div>
        }
        meta={
          roomOpen && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-100 px-2.5 py-1 text-xs font-semibold text-success-700 dark:bg-success-950/50 dark:text-success-300">
              <span aria-hidden="true" className="relative flex size-1.5">
                <span className="absolute inline-flex size-full rounded-full bg-success-500 opacity-75 motion-safe:animate-ping" />
                <span className="relative inline-flex size-1.5 rounded-full bg-success-500" />
              </span>
              Live support open
            </span>
          )
        }
        title="My issues"
      />

      {issues.length === 0 ? (
        <EmptyState
          action={
            <Link className={primaryButtonClass} href={NEW_ISSUE_HREF}>
              <PlusIcon />
              Create an issue
            </Link>
          }
          description="Stuck on a lesson, assignment or course access? Open an issue and a mentor replies here."
          icon={<MessageSquareIcon size={18} />}
        >
          No issues yet
        </EmptyState>
      ) : (
        <>
          <MyIssuesFilter counts={counts} view={view} />
          {visible.length === 0 ? (
            <EmptyState
              action={
                <Link
                  className="text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
                  href={myIssuesViewHref("all")}
                  scroll={false}
                >
                  Show all issues
                </Link>
              }
            >
              No issues in this view.
            </EmptyState>
          ) : (
            <ul className="space-y-3" aria-label="My issues">
              {visible.map((issue, index) => (
                <li key={issue.id}>
                  <MyIssueCard enterIndex={index} issue={issue} now={now} roomOpen={roomOpen} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
