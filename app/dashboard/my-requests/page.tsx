import Link from "next/link";

import { StatusBadge } from "@/components/issues/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { requireSession } from "@/lib/auth-guard";
import { caseRefFor, currentShift, SUPPORT_TIME_ZONE } from "@/lib/config/live-support";
import { LIVE_SUPPORT_ELIGIBLE_STATUSES } from "@/lib/constants";
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

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 py-6">
      <PageHeader
        action={
          <Link
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
            href="/dashboard/issues/new"
          >
            Submit a request
          </Link>
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

            return (
              <Link
                key={issue.id}
                className="flex flex-col gap-2 px-4 py-4 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-slate-800/60"
                href={`/dashboard/issues/${issue.id}`}
              >
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-900 dark:text-white">{issue.title}</h2>
                    <StatusBadge status={issue.status} />
                    {roomOpen && eligible && (
                      <span className="rounded-full bg-success-100 px-2 py-0.5 text-xs font-semibold text-success-700 dark:bg-success-950/50 dark:text-success-300">
                        Live now
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="select-all font-mono font-semibold">
                      {caseRefFor(issue.id)}
                    </span>{" "}
                    · Updated {timestamp(issue.updatedAt)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold text-primary">Open</span>
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
