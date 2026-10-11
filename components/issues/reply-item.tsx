"use client";

import { useState } from "react";

import { deleteReplyAction, editReplyAction } from "@/actions/replies";
import { PencilIcon, TrashIcon } from "@/components/icons";
import { LinkList } from "@/components/shared/link-list";
import { nativeLabelClass, nativeTextareaClass } from "@/lib/config/fields";
import type { SupportReplyListItem } from "@/lib/services/replies";

const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";

export function ReplyItem({
  issueId,
  reply,
  canEdit,
  csrfToken = "",
}: {
  issueId: string;
  reply: SupportReplyListItem;
  canEdit: boolean;
  csrfToken?: string;
}) {
  const [editing, setEditing] = useState(false);

  return (
    <article
      data-testid={`reply-${reply.id}`}
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6"
    >
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium">{reply.authorName ?? "Staff"}</span>
          {reply.createdAt ? (
            <>
              {" · "}
              <time dateTime={new Date(reply.createdAt).toISOString()}>
                {new Date(reply.createdAt).toLocaleString("en-US")}
              </time>
            </>
          ) : null}
          {reply.editedAt ? " · edited" : ""}
        </p>

        {canEdit && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Edit"
              aria-expanded={editing}
              title="Edit reply"
              onClick={() => setEditing((value) => !value)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <PencilIcon size={16} />
            </button>
            <form
              action={deleteReplyAction.bind(null, issueId, reply.id)}
              onSubmit={(event) => {
                if (!window.confirm("Delete this reply? This cannot be undone.")) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <button
                type="submit"
                aria-label="Delete"
                title="Delete reply"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-danger-600 transition hover:bg-danger-50 dark:text-danger-300 dark:hover:bg-danger-950/40"
              >
                <TrashIcon size={16} />
              </button>
            </form>
          </div>
        )}
      </div>

      <p className="whitespace-pre-wrap break-words text-base leading-7 text-slate-700 dark:text-slate-200">
        {reply.body}
      </p>
      <LinkList fileLinks={reply.fileLinks} videoLinks={reply.videoLinks} />
      {canEdit && editing && (
        <form
          action={editReplyAction.bind(null, issueId, reply.id)}
          onSubmit={() => setEditing(false)}
          className="mt-3 space-y-3"
        >
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <label className={nativeLabelClass}>
            Edit Reply <span className="text-danger">*</span>
            <textarea name="body" defaultValue={reply.body} rows={4} required maxLength={20_000} className={nativeTextareaClass} />
          </label>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className={secondaryButtonClass}>
              Cancel
            </button>
            <button type="submit" className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-600">
              Save
            </button>
          </div>
        </form>
      )}
    </article>
  );
}