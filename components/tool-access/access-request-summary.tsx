import Link from "next/link";

import { HelpCircleIcon } from "@/components/icons";
import { surfaceClass, surfaceHeaderClass } from "@/lib/ui";

/**
 * Admin-only roll-up of the tool-access queue. It answers "how much admin work
 * is waiting?" and links straight into the matching tab, so the dashboard is a
 * starting point rather than a second copy of the queue.
 */
export function AccessRequestSummary({
  openAiPending,
  n8nPending,
}: {
  openAiPending: number;
  n8nPending: number;
}) {
  const rows = [
    {
      key: "openai",
      label: "OpenAI access",
      count: openAiPending,
      href: "/dashboard/access-requests?tab=openai",
    },
    {
      key: "n8n",
      label: "n8n access & reset",
      count: n8nPending,
      href: "/dashboard/access-requests?tab=n8n",
    },
  ] as const;

  return (
    <section aria-labelledby="access-summary-heading" className={surfaceClass}>
      <div className={surfaceHeaderClass}>
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300">
            <HelpCircleIcon aria-hidden size={16} />
          </span>
          <h2
            className="text-sm font-semibold text-slate-900 dark:text-white"
            id="access-summary-heading"
          >
            Access requests
          </h2>
        </div>
        <Link
          className="text-xs font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
          href="/dashboard/access-requests"
        >
          Open queue →
        </Link>
      </div>

      <div className="grid divide-y divide-slate-200 sm:grid-cols-2 sm:divide-x sm:divide-y-0 dark:divide-slate-800">
        {rows.map((row) => (
          <Link
            key={row.key}
            className="flex items-center justify-between gap-3 px-4 py-3 transition-colors duration-150 hover:bg-slate-50 motion-reduce:transition-none dark:hover:bg-slate-800/40"
            href={row.href}
          >
            <span className="text-sm text-slate-600 dark:text-slate-300">{row.label}</span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-lg font-semibold tabular-nums text-slate-900 dark:text-white">
                {row.count}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">pending</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
