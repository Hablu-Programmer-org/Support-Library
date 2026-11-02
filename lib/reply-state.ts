export type IssueReplyState = {
  lastStaffReplyAt: Date | null;
  lastStudentReplyAt: Date | null;
  awaitingStaff: boolean;
};

/**
 * Canonical legacy fallback used by reads, writes and the backfill.
 * New replies carry `isStaffReply`; old rows fall back to the author's current
 * local role until the guarded backfill freezes the value.
 */
export const EFFECTIVE_STAFF_REPLY_EXPRESSION = {
  $ifNull: [
    "$isStaffReply",
    { $in: [{ $arrayElemAt: ["$author.role", 0] }, ["ADMIN", "MENTOR"]] },
  ],
} as const;

export function deriveIssueReplyState(
  lastStaffReplyAt: Date | null,
  lastStudentReplyAt: Date | null,
): IssueReplyState {
  return {
    lastStaffReplyAt,
    lastStudentReplyAt,
    awaitingStaff: !lastStaffReplyAt || Boolean(
      lastStudentReplyAt && lastStudentReplyAt.getTime() > lastStaffReplyAt.getTime(),
    ),
  };
}
