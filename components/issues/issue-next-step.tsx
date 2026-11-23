import Link from "next/link";
import type { ComponentProps } from "react";

import { LiveSupportGuideButton } from "@/components/live-support/live-support-guide-button";

/**
 * End of a published issue for a student: the answer above did not help, so
 * point to the two ways forward instead of ending the page on metadata.
 * Live support opens the how-to dialog (`LiveSupportGuideButton`), which also
 * carries the direct join.
 */
export function IssueNextStep({
  liveSupportStatus,
  join,
  stacked = false,
  className = "",
}: {
  liveSupportStatus: string;
  join: ComponentProps<typeof LiveSupportGuideButton>["join"];
  /** Narrow column (the reader's sidebar): text above, buttons below. */
  stacked?: boolean;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="issue-next-step-title"
      className={`flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70 ${
        stacked ? "" : "sm:flex-row sm:items-center sm:justify-between sm:p-6"
      } ${className}`}
    >
      <div className="min-w-0">
        <h2
          id="issue-next-step-title"
          className="text-base font-semibold text-slate-900 dark:text-white"
        >
          Still stuck?
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{liveSupportStatus}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600 cursor-pointer"
          href="/dashboard/issues/new"
        >
          Create an issue
        </Link>
        <LiveSupportGuideButton join={join} statusLabel={liveSupportStatus} />
      </div>
    </section>
  );
}
