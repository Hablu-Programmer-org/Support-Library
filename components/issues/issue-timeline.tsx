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
      <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center dark:border-slate-700 dark:bg-slate-900/50">
        <p className="font-medium text-slate-700 dark:text-slate-200">
          No responses yet
        </p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          A support team response will appear here.
        </p>
      </section>
    );
  }

  // Replies are editable by their author, and by ADMIN as an override.
  const mayMutateAny = Boolean(viewerRole && canMutate(viewerRole));

  return (
    <ol className="space-y-4" aria-label="Issue responses">
      {replies.map((reply) => {
        const isOwner = reply.authorId === viewerId;
        const canEdit = mayMutateAny && (isOwner || isAdmin(viewerRole!));

        return (
          <li key={reply.id}>
            <ReplyItem issueId={issueId} reply={reply} canEdit={canEdit} />
          </li>
        );
      })}
    </ol>
  );
}
