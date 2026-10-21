import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/components/issues/status-badge";
import { LiveSupportJoinQueue } from "@/components/live-support/join-queue";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { getDashboardStats, getRecentUnresolvedIssues, getTopTags } from "@/lib/services/analytics";
import { requireSession } from "@/lib/auth-guard";
import { dayKeyInDhaka, SUPPORT_TIME_ZONE } from "@/lib/config/live-support";
import { canMutate } from "@/lib/roles";
import { listStudentRequestsAwaitingStaff } from "@/lib/services/issues";
import { countLiveSupportJoins, listLiveSupportQueue } from "@/lib/services/live-support-joins";

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
  if (!canMutate(session.user.role ?? "STUDENT")) redirect("/dashboard/issues");

  const dayKey = dayKeyInDhaka(new Date());
  const [stats, recentIssues, topTags, waiting, waitingCount, awaitingMentor] = await Promise.all([
    getDashboardStats(false),
    getRecentUnresolvedIssues(8, false),
    getTopTags(10, false),
    listLiveSupportQueue(dayKey),
    countLiveSupportJoins(dayKey),
    listStudentRequestsAwaitingStaff(8),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        action={
          <Link
            className="inline-flex items-center justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            href="/dashboard/live-support"
          >
            Open live support queue
          </Link>
        }
        description="What came in, and who is waiting in the room right now."
        title="Dashboard"
      />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard hint="Total issues" label="Support Issues" value={stats.totalIssues} />
        <StatCard hint="Open, pending or follow-up" label="Unresolved" value={stats.unresolvedIssues} />
        <StatCard hint="New issues in the last 7 days" label="Issues This Week" value={stats.weeklyIssues} />
        <StatCard
          hint="Students in the room today"
          label="Waiting Now"
          value={waitingCount}
        />
      </div>

      <LiveSupportJoinQueue dayKey={dayKey} entries={waiting} />

      <section
        aria-labelledby="awaiting-mentor-heading"
        className="space-y-3 border-t border-slate-200 pt-6 dark:border-slate-800"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2
            id="awaiting-mentor-heading"
            className="text-lg font-semibold text-slate-900 dark:text-white"
          >
            Student requests awaiting a mentor
          </h2>
          <Link className="text-xs font-semibold text-primary hover:underline" href="/dashboard/issues">
            All issues
          </Link>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Submitted by students and not assigned to a mentor yet — oldest first.
        </p>

        {awaitingMentor.length === 0 ? (
          <EmptyState>No student request is waiting to be picked up.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {awaitingMentor.map((issue) => (
              <li key={issue.id}>
                <Link
                  className="flex flex-col gap-2 py-3 transition hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-slate-800/60"
                  href={`/dashboard/issues/${issue.id}`}
                >
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-cyan-700 dark:text-cyan-300">{issue.title}</span>
                    <StatusBadge status={issue.status} />
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {timestamp(issue.createdAt)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
          <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Recent Unresolved Issues</h2>
          <div className="space-y-2">
            {recentIssues.length === 0 ? (
              <EmptyState>No unresolved issues.</EmptyState>
            ) : (
              recentIssues.map((item) => (
                <Link
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 p-3 transition hover:border-cyan-500 dark:border-slate-800"
                  href={`/dashboard/issues/${item.id}`}
                >
                  <span className="font-medium text-cyan-600 dark:text-cyan-400">{item.title}</span>
                  <StatusBadge status={item.status} />
                </Link>
              ))
            )}
          </div>
        </section>

        <section className="border-t border-slate-200 pt-5 dark:border-slate-800">
          <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Popular Tags</h2>
          {topTags.length === 0 ? (
            <EmptyState>No tags yet.</EmptyState>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topTags.map((item) => (
                <Link
                  key={item.tag}
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm transition hover:bg-cyan-100 hover:text-cyan-700 dark:bg-slate-800 dark:hover:bg-cyan-900/40"
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
