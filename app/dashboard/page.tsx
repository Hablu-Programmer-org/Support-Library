import Link from "next/link";
import { redirect } from "next/navigation";

import {
  CaseIcon,
  MessageSquareIcon,
  UserIcon,
  VideoIcon,
} from "@/components/icons";
import { StatusBadge } from "@/components/issues/status-badge";
import { LiveSupportJoinQueue } from "@/components/live-support/join-queue";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { AccessRequestSummary } from "@/components/tool-access/access-request-summary";
import { getDashboardStats, getRecentUnresolvedIssues, getTopTags } from "@/lib/services/analytics";
import { requireSession } from "@/lib/auth-guard";
import { dayKeyInDhaka, SUPPORT_TIME_ZONE } from "@/lib/config/live-support";
import { buildIssueDetailHref } from "@/lib/issue-list-params";
import { isN8nAdmin } from "@/lib/n8n-request-policy";
import { canMutate, isAdmin } from "@/lib/roles";
import { listStudentRequestsAwaitingStaff } from "@/lib/services/issues";
import { countStillWaiting, listLiveSupportQueue } from "@/lib/services/live-support-joins";
import { countPendingN8nRequests } from "@/lib/services/n8n-requests";
import { rowHoverClass, secondaryButtonClass, surfaceClass, surfaceHeaderClass } from "@/lib/ui";

export const dynamic = "force-dynamic";

const timestamp = (date?: Date | null) =>
  date
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: SUPPORT_TIME_ZONE,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date)
    : "—";

export default async function DashboardPage() {
  const session = await requireSession();
  const role = session.user.role ?? "STUDENT";
  if (!canMutate(role)) redirect("/dashboard/issues");

  const dayKey = dayKeyInDhaka(new Date());
  // The access queue is a separate admin surface with its own exact-role gate,
  // so the dashboard only advertises it to someone who can actually open it.
  const showAccessQueue = isAdmin(role) && (await isN8nAdmin(session.user.email));

  const [stats, recentIssues, topTags, waiting, awaitingMentor, accessCounts] = await Promise.all([
    getDashboardStats(false),
    getRecentUnresolvedIssues(6, false),
    getTopTags(10, false),
    listLiveSupportQueue(dayKey),
    listStudentRequestsAwaitingStaff(6),
    showAccessQueue
      ? Promise.all([
          countPendingN8nRequests(["OPENAI_ACCESS"]),
          countPendingN8nRequests(["ACCESS", "PASSWORD_RESET"]),
        ])
      : Promise.resolve(null),
  ]);
  // A join row survives after a case is solved, so the card counts only those
  // requests that are still unresolved (the list below stays a full log).
  const waitingNow = countStillWaiting(waiting);

  return (
    <div className="space-y-5">
      <PageHeader
        action={
          <Link className={secondaryButtonClass} href="/dashboard/live-support">
            Open live support queue
          </Link>
        }
        description="What came in, who is waiting in the room, and how much admin work is left."
        eyebrow="Operations"
        title="Dashboard"
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          hint="Every request ever submitted"
          href="/dashboard/issues"
          icon={<CaseIcon size={16} />}
          label="Support Issues"
          value={stats.totalIssues}
        />
        <StatCard
          hint="Open, pending or follow-up"
          href="/dashboard/issues"
          icon={<MessageSquareIcon size={16} />}
          label="Unresolved"
          tone="warning"
          value={stats.unresolvedIssues}
        />
        <StatCard
          hint="New issues in the last 7 days"
          icon={<UserIcon size={16} />}
          label="Issues This Week"
          tone="primary"
          value={stats.weeklyIssues}
        />
        <StatCard
          hint="Unresolved requests with a student in the room"
          href="/dashboard/live-support"
          icon={<VideoIcon size={16} />}
          label="Waiting Now"
          tone="success"
          value={waitingNow}
        />
      </div>

      {accessCounts && (
        <AccessRequestSummary openAiPending={accessCounts[0]} n8nPending={accessCounts[1]} />
      )}

      <LiveSupportJoinQueue dayKey={dayKey} entries={waiting} />

      <section aria-labelledby="awaiting-mentor-heading" className={surfaceClass}>
        <div className={surfaceHeaderClass}>
          <div className="min-w-0">
            <h2
              className="text-sm font-semibold text-slate-900 dark:text-white"
              id="awaiting-mentor-heading"
            >
              Student requests awaiting a mentor
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Submitted by students and not assigned to a mentor yet — oldest first.
            </p>
          </div>
          <Link
            className="text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
            href="/dashboard/issues"
          >
            All issues →
          </Link>
        </div>

        {awaitingMentor.length === 0 ? (
          <EmptyState className="rounded-none border-0 bg-transparent dark:bg-transparent">
            No student request is waiting to be picked up.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {awaitingMentor.map((issue) => (
              <li key={issue.id}>
                <Link
                  className={`flex flex-col gap-1.5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${rowHoverClass}`}
                  href={buildIssueDetailHref(issue.id, "/dashboard")}
                >
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="truncate font-medium text-slate-900 dark:text-white">
                      {issue.title}
                    </span>
                    <StatusBadge status={issue.status} />
                  </span>
                  <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                    {timestamp(issue.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-labelledby="recent-issues-heading" className={surfaceClass}>
          <div className={surfaceHeaderClass}>
            <h2
              className="text-sm font-semibold text-slate-900 dark:text-white"
              id="recent-issues-heading"
            >
              Recent Unresolved Issues
            </h2>
            <Link
              className="text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
              href="/dashboard/issues"
            >
              View all →
            </Link>
          </div>
          {recentIssues.length === 0 ? (
            <EmptyState className="rounded-none border-0 bg-transparent dark:bg-transparent">
              No unresolved issues.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-slate-200 dark:divide-slate-800">
              {recentIssues.map((item) => (
                <li key={item.id}>
                  <Link
                    className={`flex items-center justify-between gap-3 px-4 py-3 ${rowHoverClass}`}
                    href={buildIssueDetailHref(item.id, "/dashboard")}
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900 dark:text-white">
                      {item.title}
                    </span>
                    <StatusBadge status={item.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="popular-tags-heading" className={surfaceClass}>
          <div className={surfaceHeaderClass}>
            <h2
              className="text-sm font-semibold text-slate-900 dark:text-white"
              id="popular-tags-heading"
            >
              Popular Tags
            </h2>
          </div>
          {topTags.length === 0 ? (
            <EmptyState className="rounded-none border-0 bg-transparent dark:bg-transparent">
              No tags yet.
            </EmptyState>
          ) : (
            <div className="flex flex-wrap gap-2 p-4">
              {topTags.map((item) => (
                <Link
                  key={item.tag}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 transition-colors duration-150 hover:bg-cyan-100 hover:text-cyan-800 motion-reduce:transition-none dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-cyan-900/40 dark:hover:text-cyan-200"
                  href={`/dashboard/issues?tag=${encodeURIComponent(item.tag)}`}
                >
                  {item.tag} ({item.count})
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
