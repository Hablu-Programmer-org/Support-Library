import Link from "next/link";

import { cn } from "@/lib/cn";
import {
  buildIssueListHref,
  type IssueFilterDefaults,
  type IssueSort,
} from "@/lib/issue-list-params";

/** One label per status, shared by the chips and the drawer's Status select. */
export const ISSUE_STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  SOLVED: "Solved",
  PENDING: "Pending",
  FOLLOW_UP: "Follow-up",
  ARCHIVED: "Archived",
};

/** Statuses offered as chips. Archived is a staff view only. */
const STUDENT_CHIP_STATUSES = ["OPEN", "SOLVED", "PENDING", "FOLLOW_UP"] as const;
const STAFF_CHIP_STATUSES = [...STUDENT_CHIP_STATUSES, "ARCHIVED"] as const;

/**
 * One-tap status filter under the search bar.
 *
 * Plain links (not form fields), so the form still posts a single `status`
 * from the drawer. Each link keeps the keyword and every other filter and
 * restarts at page 1. Fixed height, scrolls sideways on a phone instead of
 * wrapping, so the card above the hero keeps one known height.
 */
export function IssueStatusChips({
  defaults,
  defaultSort,
  staff = false,
}: {
  defaults: IssueFilterDefaults;
  defaultSort: IssueSort;
  staff?: boolean;
}) {
  const statuses = staff ? STAFF_CHIP_STATUSES : STUDENT_CHIP_STATUSES;
  const active = (statuses as readonly string[]).includes(defaults.status) ? defaults.status : "";
  const chips = [
    { value: "", label: "All" },
    ...statuses.map((value) => ({ value, label: ISSUE_STATUS_LABELS[value] })),
  ];

  return (
    <nav aria-label="Filter by status" className="mt-2 px-1">
      <ul className="flex h-8 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {chips.map(({ value, label }) => {
          const isActive = value === active;
          return (
            <li key={value || "all"} className="shrink-0">
              <Link
                aria-current={isActive ? "true" : undefined}
                className={cn(
                  "inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold whitespace-nowrap transition duration-150 motion-safe:hover:-translate-y-px",
                  isActive
                    ? "bg-cyan-500/15 text-cyan-700 ring-1 ring-inset ring-cyan-500/30 dark:text-cyan-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white",
                )}
                href={buildIssueListHref({ ...defaults, status: value, page: 1 }, { defaultSort })}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
