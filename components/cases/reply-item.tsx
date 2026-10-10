"use client";

import { deleteReplyAction, editReplyAction } from "@/actions/replies";
import { LinkList } from "@/components/shared/link-list";
import { nativeLabelClass, nativeTextareaClass } from "@/lib/config/fields";
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
            {reply.createdAt ? new Date(reply.createdAt).toLocaleString("en-US") : ""}
            {reply.editedAt ? " · edited" : ""}
          </div>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <form action={deleteReplyAction.bind(null, caseId, reply.id)}>
              <button type="submit" className="inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-danger-600 transition hover:bg-danger-50 dark:text-danger-300 dark:hover:bg-danger-950/40">
                Delete
              </button>
            </form>
          </div>
        )}
      </div>

      <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700 dark:text-slate-200">
        {reply.body}
      </p>
      <LinkList fileLinks={reply.fileLinks} videoLinks={reply.videoLinks} />
      {canEdit && (
        <details className="mt-3">
          <summary className="inline-flex cursor-pointer items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" role="button">
            Edit
          </summary>
          <form action={editReplyAction.bind(null, caseId, reply.id)} className="mt-3 space-y-3">
            <label className={nativeLabelClass}>
              Edit Reply <span className="text-danger">*</span>
              <textarea name="body" defaultValue={reply.body} rows={4} required maxLength={20_000} className={nativeTextareaClass} />
            </label>
            <div className="flex justify-end">
              <button type="submit" className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-600">
                Save
              </button>
            </div>
          </form>
        </details>
      )}
    </article>
  );
}
