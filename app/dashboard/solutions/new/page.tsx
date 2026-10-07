import Link from "next/link";

import { SolutionForm } from "@/components/solutions/solution-form";
import { requireMentorOrAdmin } from "@/lib/auth-guard";
import { getCaseDetail } from "@/lib/services/cases";
import { listReplies } from "@/lib/services/replies";
import { buildSolutionPrefill, type SolutionPrefill } from "@/lib/solution-prefill";

export const dynamic = "force-dynamic";

export default async function NewSolutionPage({
  searchParams,
}: {
  searchParams?: { fromCase?: string | string[] };
}) {
  const session = await requireMentorOrAdmin();

  const rawFromCase = Array.isArray(searchParams?.fromCase)
    ? searchParams?.fromCase[0]
    : searchParams?.fromCase;

  let prefill: SolutionPrefill | undefined;
  let sourceCaseTitle: string | undefined;

  if (rawFromCase) {
    const supportCase = await getCaseDetail(rawFromCase);
    if (supportCase) {
      // Internal notes stay internal, so only public replies feed the prefill.
      const replies = await listReplies(rawFromCase, false);
      const latest = replies[replies.length - 1];
      prefill = buildSolutionPrefill({
        title: supportCase.title,
        question: supportCase.question,
        tags: supportCase.tags,
        replyBody: latest?.body,
      });
      sourceCaseTitle = supportCase.title;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/dashboard/solutions" className="text-sm text-primary hover:underline">← সলিউশন লিস্টে ফিরে যান</Link>
        <h1 className="mt-2 text-2xl font-bold">নতুন সলিউশন</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Default visibility INTERNAL.</p>
      </div>

      {sourceCaseTitle && (
        <p
          data-testid="solution-prefill-banner"
          className="rounded-xl border border-primary/40 bg-primary/5 p-3 text-sm"
        >
          Case থেকে draft তৈরি হয়েছে: <span className="font-medium">{sourceCaseTitle}</span> — নিজের ভাষায় ঠিক করে নিন।
        </p>
      )}

      <SolutionForm canPublish={session.user.role === "ADMIN"} defaults={prefill} />
    </div>
  );
}