import { Card, CardBody, CardHeader } from "@heroui/react";
import Link from "next/link";

import { StatusBadge } from "@/components/cases/status-badge";
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">ড্যাশবোর্ড</h1>
        <Link href="/dashboard/analytics" className="text-sm text-primary hover:underline">
          বিস্তারিত অ্যানালিটিক্স
        </Link>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader>সাপোর্ট কেস</CardHeader>
          <CardBody>
            <p className="text-3xl font-bold">{stats.totalCases}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">মোট কেস</p>
          </CardBody>
        </Card>
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader>অমীমাংসিত</CardHeader>
          <CardBody>
            <p className="text-3xl font-bold">{stats.unresolvedCases}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">open/pending/follow-up</p>
          </CardBody>
        </Card>
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader>সলিউশন আর্টিকেল</CardHeader>
          <CardBody>
            <p className="text-3xl font-bold">{stats.totalSolutions}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">মোট আর্টিকেল</p>
          </CardBody>
        </Card>
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader>এই সপ্তাহের কেস</CardHeader>
          <CardBody>
            <p className="text-3xl font-bold">{stats.weeklyCases}</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">নতুন কেস</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="font-semibold">সাম্প্রতিক অমীমাংসিত কেস</CardHeader>
          <CardBody className="space-y-2">
            {recentCases.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">কোনো unresolved case নেই।</p> : recentCases.map((item) => (
              <Link key={item.id} href={`/dashboard/cases/${item.id}`} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 hover:border-primary dark:border-gray-700">
                <span className="font-medium text-primary">{item.title}</span>
                <StatusBadge status={item.status} />
              </Link>
            ))}
          </CardBody>
        </Card>

        <Card className="border border-gray-200 dark:border-gray-700">
          <CardHeader className="font-semibold">জনপ্রিয় ট্যাগ</CardHeader>
          <CardBody>
            {topTags.length === 0 ? <p className="text-sm text-gray-500 dark:text-gray-400">এখনো tag data নেই।</p> : (
              <div className="flex flex-wrap gap-2">
                {topTags.map((item) => <Link key={item.tag} href={`/dashboard/cases?tag=${encodeURIComponent(item.tag)}`} className="rounded-full bg-gray-100 px-3 py-1 text-sm dark:bg-gray-800">{item.tag} ({item.count})</Link>)}
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
