import Link from "next/link";

import { CheckCircleIcon, ChevronDownIcon, HelpCircleIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

export type ReadinessItem = {
  id: string;
  label: string;
  done: boolean;
  /** Shown, but never counted towards "ready". */
  optional?: boolean;
};

const card =
  "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70";

function Checklist({ items }: { items: ReadinessItem[] }) {
  return (
    <ul className="space-y-2.5 text-sm">
      {items.map((item) => (
        <li key={item.id} data-readiness={item.id} data-done={item.done ? "" : undefined} className="flex items-start gap-2.5">
          {item.done ? (
            <CheckCircleIcon aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-success-600 dark:text-success-600" />
          ) : (
            <span
              aria-hidden="true"
              className="mt-[3px] size-[15px] shrink-0 rounded-full border-2 border-slate-300 dark:border-slate-600"
            />
          )}
          <span className={item.done ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}>
            <span className="sr-only">{item.done ? "Done: " : "To do: "}</span>
            {item.label}
            {item.optional ? <span className="text-slate-500 dark:text-slate-400"> · optional</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Tips() {
  return (
    <div className="space-y-3 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
      <p className="leading-6 text-slate-600 dark:text-slate-300">One problem per issue.</p>
      <Link
        href="/dashboard/issues"
        className="inline-flex min-h-11 items-center font-semibold text-cyan-700 hover:underline dark:text-cyan-300"
      >
        Search published answers first →
      </Link>
      <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
        After creating it, track replies and open Live support from the issue page during support hours.
      </p>
    </div>
  );
}

/**
 * Live "before you submit" checklist beside the create form: a sticky card on
 * desktop, a closed disclosure above the form on small screens whose summary
 * still shows the progress. Progress is not announced on every keystroke; the
 * count sits in the heading for whoever reads it.
 */
export function IssueReadinessPanel({ items }: { items: ReadinessItem[] }) {
  const required = items.filter((item) => !item.optional);
  const ready = required.filter((item) => item.done).length;
  const progress = `${ready} of ${required.length} ready`;
  const complete = ready === required.length;
  const progressClass = cn(
    "text-xs font-medium tabular-nums",
    complete ? "text-success-700 dark:text-success-600" : "text-slate-500 dark:text-slate-400",
  );

  return (
    <aside aria-label="Before you submit" className="min-w-0 lg:sticky lg:top-20 lg:self-start">
      <details className={`group ${card} lg:hidden`}>
        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:text-white [&::-webkit-details-marker]:hidden">
          <HelpCircleIcon aria-hidden="true" size={17} className="text-cyan-600 dark:text-cyan-300" />
          <span className="flex-1">Before you submit</span>
          <span className={progressClass}>{progress}</span>
          <ChevronDownIcon
            aria-hidden="true"
            size={16}
            className="text-slate-400 transition group-open:rotate-180 motion-reduce:transition-none"
          />
        </summary>
        <div className="space-y-4 px-5 pb-5">
          <Checklist items={items} />
          <Tips />
        </div>
      </details>

      <section aria-labelledby="before-submit-heading" className={`hidden space-y-4 p-5 lg:block ${card}`}>
        <div className="flex items-center gap-2">
          <HelpCircleIcon aria-hidden="true" size={18} className="text-cyan-600 dark:text-cyan-300" />
          <h2 id="before-submit-heading" className="flex-1 text-base font-semibold text-slate-950 dark:text-white">
            Before you submit
          </h2>
          <span className={progressClass}>{progress}</span>
        </div>
        <Checklist items={items} />
        <Tips />
      </section>
    </aside>
  );
}
