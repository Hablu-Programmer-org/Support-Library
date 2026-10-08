import Link from "next/link";

import { StatusBadge } from "@/components/cases/status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { StatCard } from "@/components/shared/stat-card";
import { getDashboardStats, getRecentUnresolvedCases, getTopTags } from "@/lib/services/analytics";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [stats, recentCases, topTags] = await Promise.all([
    getDashboardStats(),
    getRecentUnresolvedCases(),
    getTopTags(10),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="ড্যাশবোর্ড" />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard hint="মোট কেস" label="সাপোর্ট কেস" value={stats.totalCases} />
        <StatCard hint="open/pending/follow-up" label="অমীমাংসিত" value={stats.unresolvedCases} />
        <StatCard hint="মোট আর্টিকেল" label="সলিউশন আর্টিকেল" value={stats.totalSolutions} />
        <StatCard hint="নতুন কেস" label="এই সপ্তাহের কেস" value={stats.weeklyCases} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <h2 className="mb-3 font-semibold">সাম্প্রতিক অমীমাংসিত কেস</h2>
          <div className="space-y-2">
            {recentCases.length === 0 ? (
              <EmptyState>কোনো unresolved case নেই।</EmptyState>
            ) : (
              recentCases.map((item) => (
                <Link
                  key={item.id}
                  className="flex items-center justify-between rounded-xl border border-slate-200 p-3 transition hover:border-cyan-500 dark:border-slate-800"
                  href={`/dashboard/cases/${item.id}`}
                >
                  <span className="font-medium text-cyan-600 dark:text-cyan-400">{item.title}</span>
                  <StatusBadge status={item.status} />
                </Link>
              ))
            )}
          </div>
        </Panel>

        <Panel>
          <h2 className="mb-3 font-semibold">জনপ্রিয় ট্যাগ</h2>
          {topTags.length === 0 ? (
            <EmptyState>এখনো tag data নেই।</EmptyState>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topTags.map((item) => (
                <Link
                  key={item.tag}
                  className="rounded-full bg-slate-100 px-3 py-1 text-sm transition hover:bg-cyan-100 hover:text-cyan-700 dark:bg-slate-800 dark:hover:bg-cyan-900/40"
                  href={`/dashboard/cases?tag=${encodeURIComponent(item.tag)}`}
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
