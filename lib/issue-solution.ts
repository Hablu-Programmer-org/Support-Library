import type { CaseStatus } from "@/models";

type SolutionCandidate = { id: string; isStaffReply: boolean };

/**
 * The reply a solved case points readers to.
 *
 * The team's last answer before closing is the one that holds the fix; an
 * earlier staff reply is often a clarifying question (2026-11-23). Falls back
 * to the first reply when no staff reply exists. Unsolved cases have none.
 */
export function pickSolutionReplyId(
  status: CaseStatus,
  replies: readonly SolutionCandidate[],
): string | undefined {
  if (status !== "SOLVED" || replies.length === 0) return undefined;
  for (let index = replies.length - 1; index >= 0; index -= 1) {
    if (replies[index].isStaffReply) return replies[index].id;
  }
  return replies[0].id;
}

/** In-page anchor of a reply; `ReplyItem` renders the matching id. */
export const replyAnchorId = (replyId: string) => `reply-${replyId}`;

/** Last staff answer, for the reader's "Last answer" date. */
export function lastStaffReplyDate(
  replies: readonly { isStaffReply: boolean; createdAt?: Date | null }[],
): Date | null {
  let latest: Date | null = null;
  for (const reply of replies) {
    if (!reply.isStaffReply || !reply.createdAt) continue;
    if (!latest || reply.createdAt > latest) latest = reply.createdAt;
  }
  return latest;
}
