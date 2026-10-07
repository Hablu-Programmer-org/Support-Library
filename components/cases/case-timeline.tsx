import { Card, CardBody } from "@heroui/react";

import { ReplyItem } from "@/components/cases/reply-item";
import { canMutate, isAdmin, type UserRole } from "@/lib/roles";
import type { SupportReplyListItem } from "@/lib/services/replies";

export function CaseTimeline({
  caseId,
  replies,
  viewerId,
  viewerRole,
}: {
  caseId: string;
  replies: SupportReplyListItem[];
  viewerId: string;
  viewerRole?: UserRole | null;
}) {
  if (replies.length === 0) {
    return (
      <Card className="border border-slate-200 dark:border-slate-700">
        <CardBody className="text-sm text-slate-500 dark:text-slate-400">
          এখনো কোনো উত্তর বা internal note যোগ করা হয়নি।
        </CardBody>
      </Card>
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
          <ReplyItem key={reply.id} caseId={caseId} reply={reply} canEdit={canEdit} />
        );
      })}
    </div>
  );
}