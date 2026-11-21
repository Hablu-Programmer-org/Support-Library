import { ReplyItem } from "@/components/issues/reply-item";
import { canMutate, isAdmin, type UserRole } from "@/lib/roles";
import type { SupportReplyListItem } from "@/lib/services/replies";

export function IssueTimeline({
  issueId,
  replies,
  viewerId,
  viewerRole,
  csrfToken = "",
  variant = "response",
  publicView = false,
  solutionReplyId,
  ownerView = false,
}: {
  issueId: string;
  replies: SupportReplyListItem[];
  viewerId: string;
  viewerRole?: UserRole | null;
  csrfToken?: string;
  /** The first reply is the answer people came for; later ones are follow-ups. */
  variant?: "solution" | "response";
  /**
   * Student Library view: the author's name is not part of the projection, so a
   * student reply is labelled generically instead of falling back to "You".
   */
  publicView?: boolean;
  /** This reply is the accepted answer: emerald card + "Solution" badge. */
  solutionReplyId?: string;
  /** The student's own request: their replies read "You". */
  ownerView?: boolean;
}) {
  if (replies.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-5 py-6 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
        No answer yet.
      </p>
    );
  }

  // Replies are editable by their author, and by ADMIN as an override.
  const mayMutateAny = Boolean(viewerRole && canMutate(viewerRole));

  return (
    <ol
      className="space-y-3"
      aria-label={variant === "solution" ? "Issue solution" : "Issue responses"}
    >
      {replies.map((reply) => {
        const isOwner = reply.authorId === viewerId;
        const canEdit = mayMutateAny && (isOwner || isAdmin(viewerRole!));

        return (
          <li key={reply.id}>
            <ReplyItem
              issueId={issueId}
              reply={reply}
              canEdit={canEdit}
              csrfToken={csrfToken}
              variant={reply.id === solutionReplyId ? "solution" : variant}
              authorLabel={
                reply.isStaffReply ? undefined : ownerView ? "You" : publicView ? "Student" : undefined
              }
            />
          </li>
        );
      })}
    </ol>
  );
}