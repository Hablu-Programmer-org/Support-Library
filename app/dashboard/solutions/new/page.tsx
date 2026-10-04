import Link from "next/link";

import { SolutionForm } from "@/components/solutions/solution-form";
import { requireMentorOrAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function NewSolutionPage() {
  const session = await requireMentorOrAdmin();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/solutions" className="text-sm text-primary hover:underline">← সলিউশন লিস্টে ফিরে যান</Link>
        <h1 className="mt-2 text-2xl font-bold">নতুন সলিউশন</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">Default visibility INTERNAL.</p>
      </div>
      <SolutionForm canPublish={session.user.role === "ADMIN"} />
    </div>
  );
}
