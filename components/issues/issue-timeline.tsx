import { ReplyItem } from "@/components/issues/reply-item";
import { canMutate, isAdmin, type UserRole } from "@/lib/roles";
import type { SupportReplyListItem } from "@/lib/services/replies";

export function IssueTimeline({
  issueId,
  replies,
  viewerId,
  viewerRole,
}: {
  issueId: string;
  replies: SupportReplyListItem[];
  viewerId: string;
  viewerRole?: UserRole | null;
}) {
  if (replies.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No replies or internal notes yet.
        </p>
      </section>
    );
  }

  // Replies are editable by their author, and by ADMIN as an override.
  const mayMutateAny = Boolean(viewerRole && canMutate(viewerRole));

  return (
    <div className="space-y-3">
      {replies.map((reply) => {
        const isOwner = reply.authorId === viewerId;
        const canEdit = mayMutateAny && (isOwner || isAdmin(viewerRole!));

        return (
          <ReplyItem key={reply.id} issueId={issueId} reply={reply} canEdit={canEdit} />
        );
      })}
    </div>
  );
}