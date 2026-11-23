import type { CaseStatus } from "@/lib/constants";

/** Statuses that still need work, in the order staff read them. */
export const UNRESOLVED_STATUSES = ["OPEN", "PENDING", "AWAITING_STUDENT", "FOLLOW_UP"] as const satisfies readonly CaseStatus[];

export type UnresolvedStatus = (typeof UNRESOLVED_STATUSES)[number];

export type StatusCount = { status: UnresolvedStatus; count: number };

/**
 * Turns `$group` rows into one entry per unresolved status, in a fixed order.
 * A status with no issues is still listed (count 0) so the dashboard row never
 * changes shape; rows for any other status are ignored.
 */
export function toUnresolvedBreakdown(rows: Array<{ _id: unknown; count: number }>): StatusCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    if (typeof row._id === "string") counts.set(row._id, row.count);
  }
  return UNRESOLVED_STATUSES.map((status) => ({ status, count: counts.get(status) ?? 0 }));
}
