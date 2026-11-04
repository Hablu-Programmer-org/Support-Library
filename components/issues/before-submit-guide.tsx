import Link from "next/link";

import { CheckCircleIcon, HelpCircleIcon } from "@/components/icons";

const guidance = [
  "Submit one issue per request.",
  "Include the exact error and what you already tried.",
  "Add screenshots when they help explain the issue.",
];

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
        className="inline-flex text-sm font-semibold text-primary hover:underline"
      >
        Search published answers first →
      </Link>
      <p className="border-t border-slate-200 pt-4 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:text-slate-400">
        After submitting, track replies and open Live support from the request
        page during support hours.
      </p>
    </div>
  );
}

export function BeforeSubmitGuide() {
  return (
    <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
      <details className="border-y border-slate-200 py-4 dark:border-slate-800 lg:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <HelpCircleIcon aria-hidden="true" size={17} />
          Before you submit
        </summary>
        <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-800">
          <GuideContent />
        </div>
      </details>

      <section
        aria-labelledby="before-submit-heading"
        className="hidden border-l-2 border-slate-200 pl-5 dark:border-slate-800 lg:block"
      >
        <h2
          id="before-submit-heading"
          className="mb-4 flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white"
        >
          <HelpCircleIcon aria-hidden="true" size={18} />
          Before you submit
        </h2>
        <GuideContent />
      </section>
    </aside>
  );
}
