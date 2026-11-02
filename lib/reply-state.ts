export type IssueReplyState = {
  lastStaffReplyAt: Date | null;
  lastStudentReplyAt: Date | null;
  awaitingStaff: boolean;
};

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
