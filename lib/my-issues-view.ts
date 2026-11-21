import type { CaseStatus } from "@/lib/constants";

/**
 * "My issues" page: which bucket each of the student's issues falls into, and
 * which bucket the `?view=` filter shows.
 *
 * Pure and server-side — the counts and the filtered list are both derived from
 * the one `listOwnIssues` result, so they can never disagree.
 */

export const MY_ISSUES_VIEWS = ["all", "action", "active", "closed"] as const;
export type MyIssuesView = (typeof MY_ISSUES_VIEWS)[number];
export type MyIssuesGroup = Exclude<MyIssuesView, "all">;

/**
 * Exhaustive on purpose: adding a status to `CASE_STATUSES` without placing it
 * here is a type error, not a row that silently disappears from every tab.
 */
const STATUS_GROUP: Record<CaseStatus, MyIssuesGroup> = {
  AWAITING_STUDENT: "action",
  OPEN: "active",
  PENDING: "active",
  FOLLOW_UP: "active",
  SOLVED: "closed",
  ARCHIVED: "closed",
};

/**
 * The bucket for one status. A value that is not a known status (an old DB
 * row, say) lands in "active" so the student still sees it rather than losing it.
 */
export function statusGroup(status: string): MyIssuesGroup {
  return Object.hasOwn(STATUS_GROUP, status)
    ? STATUS_GROUP[status as CaseStatus]
    : "active";
}

/**
 * `?view=` comes straight from the URL, so only an exact whitelisted value is
 * accepted; anything else (missing, misspelt, injected) shows everything.
 */
export function parseMyIssuesView(raw: string | string[] | undefined): MyIssuesView {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (MY_ISSUES_VIEWS as readonly string[]).includes(value ?? "")
    ? (value as MyIssuesView)
    : "all";
}

export type MyIssuesCounts = Record<MyIssuesGroup, number> & { all: number };

export function groupMyIssues(issues: readonly { status: string }[]): MyIssuesCounts {
  const counts: MyIssuesCounts = { all: issues.length, action: 0, active: 0, closed: 0 };
  for (const issue of issues) counts[statusGroup(issue.status)] += 1;
  return counts;
}

/** Keeps the incoming order (newest activity first from `listOwnIssues`). */
export function filterMyIssues<T extends { status: string }>(
  issues: readonly T[],
  view: MyIssuesView,
): T[] {
  return view === "all"
    ? [...issues]
    : issues.filter((issue) => statusGroup(issue.status) === view);
}
