import { Button, Card, CardBody } from "@heroui/react";

import { deleteReplyAction } from "@/actions/replies";
import type { SupportReplyListItem } from "@/lib/services/replies";
import { LinkList } from "@/components/shared/link-list";

export function CaseTimeline({ caseId, replies, canMutate }: {
  caseId: string;
  replies: SupportReplyListItem[];
  canMutate: boolean;
}) {
  if (replies.length === 0) {
    return (
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardBody className="text-sm text-gray-500 dark:text-gray-400">
          এখনো কোনো উত্তর বা internal note যোগ করা হয়নি।
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {replies.map((reply) => (
        <article
          key={reply.id}
          className={
            reply.isInternalNote
              ? "rounded-2xl border border-warning-200 bg-warning-50 p-4 dark:border-warning-900/40 dark:bg-warning-950/20"
              : "rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900"
          }
        >
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{reply.authorName ?? "Staff"}</span>
                {reply.isInternalNote && (
                  <span className="rounded-full bg-warning-200 px-2 py-0.5 text-xs font-medium text-warning-800 dark:bg-warning-900/60 dark:text-warning-100">
                    Internal Note
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {reply.createdAt ? new Date(reply.createdAt).toLocaleString("bn-BD") : ""}
                {reply.editedAt ? " · edited" : ""}
              </div>
            </div>
            {canMutate && (
              <form action={deleteReplyAction.bind(null, caseId, reply.id)}>
                <Button type="submit" size="sm" color="danger" variant="light">
                  মুছুন
                </Button>
              </form>
            )}
          </div>
          <p className="whitespace-pre-wrap text-sm leading-7 text-gray-700 dark:text-gray-200">{reply.body}</p>
          <LinkList fileLinks={reply.fileLinks} videoLinks={reply.videoLinks} />
        </article>
      ))}
    </div>
  );
}
