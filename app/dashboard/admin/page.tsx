import { requireAdmin } from "@/lib/auth-guard";
import { PageHeader } from "@/components/shared/page-header";
import { Button, Card, CardBody, CardHeader } from "@heroui/react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await requireAdmin();
  const { user } = session;

  return (
    <div className="space-y-6">
      <PageHeader title="অ্যাডমিন প্যানেল" />
      <Card className="border border-slate-200 dark:border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between">
            <span>রোল গেট ডেমো</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">
              লগড ইন: {user.name} ({user.email})
            </span>
          </div>
        </CardHeader>
        <CardBody>
          <p className="text-slate-600 dark:text-slate-300">
            এই পেজটি শুধুমাত্র ADMIN রোলের জন্য দৃশ্যমান।
          </p>
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="font-medium text-green-800 dark:text-green-300">
              ✅ সার্ভার-সাইড রোল চেক সফল
            </p>
            <p className="text-sm text-green-700 dark:text-green-400">
              আপনার রোল: <strong>{user.role}</strong>
            </p>
          </div>
          <div className="mt-4">
            <Button as={Link} href="/dashboard/admin/staff" color="primary">
              Staff Management
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
