import { Card, CardBody, CardHeader } from "@heroui/react";
import Link from "next/link";

import { StatusBadge } from "@/components/cases/status-badge";
import { requireSession } from "@/lib/auth-guard";
import { getDashboardStats, getRecentUnresolvedCases, getStatusCounts, getTopTags } from "@/lib/services/analytics";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireSession();
  const [stats, statusCounts, tags, recentCases] = await Promise.all([
    getDashboardStats(),
    getStatusCounts(),
    getTopTags(20),
    getRecentUnresolvedCases(12),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">অ্যানালিটিক্স</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Support workload, repeated topics and unresolved cases overview.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Metric title="মোট কেস" value={stats.totalCases} />
        <Metric title="অমীমাংসিত" value={stats.unresolvedCases} />
        <Metric title="সলিউশন" value={stats.totalSolutions} />
        <Metric title="Staff" value={stats.staffCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="font-semibold">Status Breakdown</CardHeader>
          <CardBody className="space-y-3">
            {statusCounts.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">কোনো case data নেই।</p> : statusCounts.map((item) => (
              <div key={item.status} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                <StatusBadge status={item.status} />
                <span className="font-semibold">{item.count}</span>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="font-semibold">Top Tags</CardHeader>
          <CardBody className="space-y-2">
            {tags.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">Tag নেই।</p> : tags.map((item) => (
              <Link key={item.tag} href={`/dashboard/cases?tag=${encodeURIComponent(item.tag)}`} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 hover:border-primary dark:border-gray-700">
                <span className="text-primary">{item.tag}</span>
                <span>{item.count}</span>
              </Link>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="font-semibold">Recent Unresolved Cases</CardHeader>
        <CardBody className="space-y-2">
          {recentCases.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">সব case resolved.</p> : recentCases.map((item) => (
            <Link key={item.id} href={`/dashboard/cases/${item.id}`} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 hover:border-primary dark:border-gray-700">
              <span className="font-medium text-primary">{item.title}</span>
              <StatusBadge status={item.status} />
            </Link>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

function Metric({ title, value }: { title: string; value: number }) {
  return (
    <Card className="border border-gray-200 dark:border-gray-700">
      <CardHeader>{title}</CardHeader>
      <CardBody><p className="text-3xl font-bold">{value}</p></CardBody>
    </Card>
  );
}
