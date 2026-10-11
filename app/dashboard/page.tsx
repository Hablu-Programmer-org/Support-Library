import Link from "next/link";
import { redirect } from "next/navigation";

import { StatusBadge } from "@/components/issues/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { StatCard } from "@/components/shared/stat-card";
import { getDashboardStats, getRecentUnresolvedIssues, getTopTags } from "@/lib/services/analytics";
import { requireSession } from "@/lib/auth-guard";
import { canMutate } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();
  if (!canMutate(session.user.role ?? "VIEWER")) redirect("/dashboard/issues");
  const [stats, recentIssues, topTags] = await Promise.all([
    getDashboardStats(false),
    getRecentUnresolvedIssues(8, false),
    getTopTags(10, false),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <StatCard hint="Total issues" label="Support Issues" value={stats.totalIssues} />
        <StatCard hint="Open, pending or follow-up" label="Unresolved" value={stats.unresolvedIssues} />
        <StatCard hint="New issues in the last 7 days" label="Issues This Week" value={stats.weeklyIssues} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-3 font-semibold">Recent Unresolved Issues</h2>
          <div className="space-y-2">
            {recentIssues.length === 0 ? (
              <EmptyState>No unresolved issues.</EmptyState>
            ) : (
              recentIssues.map((item) => (
                <Link
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:border-cyan-500 dark:border-slate-800"
                  href={`/dashboard/issues/${item.id}`}
                >
                  <span className="font-medium text-cyan-600 dark:text-cyan-400">{item.title}</span>
                  <StatusBadge status={item.status} />
                </Link>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-3 font-semibold">Popular Tags</h2>
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
        </Panel>
      </div>
    </div>
  );
}
