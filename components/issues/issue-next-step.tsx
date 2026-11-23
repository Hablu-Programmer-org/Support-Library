import Link from "next/link";

import { QuickLiveSupportButton } from "@/components/live-support/quick-live-support-button";
import type { SupportPhase } from "@/lib/config/live-support";

/**
 * End of a published issue for a student: the answer above did not help, so
 * point to the two ways forward instead of ending the page on metadata.
 * The live-support line comes from the schedule (`liveSupportNow`), so the
 * disabled join button always has its reason in plain text next to it.
 */
export function IssueNextStep({
  csrfToken,
  shift,
  liveSupportConfigured,
  liveSupportLabel,
}: {
  csrfToken: string;
  shift: SupportPhase;
  liveSupportConfigured: boolean;
  liveSupportLabel: string;
}) {
  return (
    <section
      aria-labelledby="issue-next-step-title"
      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6 dark:border-slate-800 dark:bg-slate-900/70"
    >
      <div className="min-w-0">
        <h2
          id="issue-next-step-title"
          className="text-base font-semibold text-slate-900 dark:text-white"
        >
          Still stuck?
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {liveSupportConfigured ? liveSupportLabel : "Live support is unavailable right now"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600 cursor-pointer"
          href="/dashboard/issues/new"
        >
          Create an issue
        </Link>
        <QuickLiveSupportButton
          configured={liveSupportConfigured}
          csrfToken={csrfToken}
          shift={shift}
        />
      </div>
    </section>
  );
}
