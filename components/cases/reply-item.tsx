"use client";

import { Button, Textarea } from "@heroui/react";
import { useState } from "react";

import { deleteReplyAction, editReplyAction } from "@/actions/replies";
import { LinkList } from "@/components/shared/link-list";
import type { SupportReplyListItem } from "@/lib/services/replies";

export function ReplyItem({
  caseId,
  reply,
  canEdit,
}: {
  caseId: string;
  reply: SupportReplyListItem;
  canEdit: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);

  return (
    <article
      data-testid={`reply-${reply.id}`}
      className={
        reply.isInternalNote
          ? "rounded-2xl border border-warning-200 bg-warning-50 p-4 dark:border-warning-900/40 dark:bg-warning-950/20"
          : "rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
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
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {reply.createdAt ? new Date(reply.createdAt).toLocaleString("bn-BD") : ""}
            {reply.editedAt ? " · edited" : ""}
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            {!isEditing && (
              <Button
                type="button"
                size="sm"
                variant="light"
                onPress={() => setIsEditing(true)}
              >
                এডিট
              </Button>
            )}
            <form action={deleteReplyAction.bind(null, caseId, reply.id)}>
              <Button type="submit" size="sm" color="danger" variant="light">
                মুছুন
              </Button>
            </form>
          </div>
        )}
      </div>

      {isEditing ? (
        <form action={editReplyAction.bind(null, caseId, reply.id)} className="space-y-3">
          <Textarea
            name="body"
            label="উত্তর সম্পাদনা"
            defaultValue={reply.body}
            minRows={4}
            isRequired
            maxLength={20_000}
          />
          <div className="flex justify-end gap-2">
            <Button type="button" size="sm" variant="light" onPress={() => setIsEditing(false)}>
              বাতিল
            </Button>
            <Button type="submit" size="sm" color="primary">
              সংরক্ষণ
            </Button>
          </div>
        </form>
      ) : (
        <>
          <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">
            {reply.body}
          </p>
          <LinkList fileLinks={reply.fileLinks} videoLinks={reply.videoLinks} />
        </>
      )}
    </article>
  );
}