import Link from "next/link";

import { CheckCircleIcon, ChevronDownIcon, HelpCircleIcon } from "@/components/icons";

const guidance = [
  "Submit one problem per issue.",
  "Include the exact error and what you already tried.",
  "Add screenshots when they help explain the issue.",
];

const card =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70";

function GuideContent() {
  return (
    <div className="space-y-4">
      <ul className="space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
        {guidance.map((item) => (
          <li key={item} className="flex items-start gap-2.5">
            <CheckCircleIcon
              aria-hidden="true"
              className="mt-1 shrink-0 text-cyan-600 dark:text-cyan-300"
              size={15}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/dashboard/issues"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
      >
        Search published answers first →
      </Link>
      {/* The only place this line appears on the page. */}
      <p className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
        After creating it, track replies and open Live support from the issue
        page during support hours.
      </p>
    </div>
  );
}

/**
 * Tips beside the create form: a sticky card on desktop, a closed card above
 * the form on small screens.
 */
export function BeforeSubmitGuide() {
  return (
    <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
      <details className={`group ${card} lg:hidden`}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:text-white [&::-webkit-details-marker]:hidden">
          <HelpCircleIcon aria-hidden="true" size={17} className="text-cyan-600 dark:text-cyan-300" />
          <span className="flex-1">Before you submit</span>
          <ChevronDownIcon
            aria-hidden="true"
            size={16}
            className="text-slate-400 transition group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="px-5 pb-5">
          <GuideContent />
        </div>
      </details>

      <section
        aria-labelledby="before-submit-heading"
        className={`hidden p-5 lg:block ${card}`}
      >
        <h2
          id="before-submit-heading"
          className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white"
        >
          <HelpCircleIcon aria-hidden="true" size={18} className="text-cyan-600 dark:text-cyan-300" />
          Before you submit
        </h2>
        <GuideContent />
      </section>
    </aside>
  );
}
