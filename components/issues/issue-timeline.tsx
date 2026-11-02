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
}: {
  issueId: string;
  replies: SupportReplyListItem[];
  viewerId: string;
  viewerRole?: UserRole | null;
  csrfToken?: string;
  /** The first reply is the answer people came for; later ones are follow-ups. */
  variant?: "solution" | "response";
}) {
  if (replies.length === 0) {
    return (
      <section className="py-6">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No answer yet. The team replies by email too.
        </p>
      </section>
    );
  }

  // Replies are editable by their author, and by ADMIN as an override.
  const mayMutateAny = Boolean(viewerRole && canMutate(viewerRole));

  return (
    <ol
      className="space-y-2"
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
              variant={variant}
            />
          </li>
        );
      })}
    </ol>
  );
}