"use client";

import { useActionState, useState } from "react";

import { deleteReplyAction, editReplyAction, type ReplyFormState } from "@/actions/replies";
import { PencilIcon, TrashIcon } from "@/components/icons";
import { AttachmentList } from "@/components/shared/attachment-list";
import { LinkList } from "@/components/shared/link-list";
import { nativeLabelClass, nativeTextareaClass } from "@/lib/config/fields";
import { formatVideoLinks } from "@/lib/format-links";
import type { SupportReplyListItem } from "@/lib/services/replies";

const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";

const INITIAL_STATE: ReplyFormState = {};

/**
 * Edit and delete report failures as form state, not as a thrown error: a
 * rate-limited or stale request used to replace the whole case page with the
 * error boundary, taking the half-written edit with it.
 */
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
  const [editState, editFormAction, editPending] = useActionState(
    editReplyAction.bind(null, issueId, reply.id),
    INITIAL_STATE,
  );
  const [deleteState, deleteFormAction] = useActionState(
    deleteReplyAction.bind(null, issueId, reply.id),
    INITIAL_STATE,
  );

  // The editor closes on a confirmed save, so a failure leaves the text in place
  // with the reason beside it. Adjusted during render (React's documented
  // pattern for deriving state from a new result) rather than in an effect.
  const [savedMessage, setSavedMessage] = useState<string | undefined>(undefined);
  if (editState.message !== savedMessage) {
    setSavedMessage(editState.message);
    if (editState.message) setEditing(false);
  }

  const editError = editState.fieldErrors?._form?.[0] ?? editState.fieldErrors?.videoLinks?.[0];
  const deleteError = deleteState.fieldErrors?._form?.[0];

  return (
    <article
      data-testid={`reply-${reply.id}`}
      className="border-b border-slate-200 py-5 last:border-b-0 dark:border-slate-800"
    >
      <header className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-200">
            {reply.authorName ?? "Staff"}
          </span>
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
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <PencilIcon size={16} />
            </button>
            <form
              action={deleteFormAction}
              onSubmit={(event) => {
                if (
                  !window.confirm("Delete this reply? This cannot be undone.")
                ) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="csrfToken" value={csrfToken} />
              <button
                type="submit"
                aria-label="Delete"
                title="Delete reply"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-danger-600 transition hover:bg-danger-50 dark:text-danger-300 dark:hover:bg-danger-950/40"
              >
                <TrashIcon size={16} />
              </button>
            </form>
          </div>
        )}
      </header>

      <p className="whitespace-pre-wrap wrap-break-word text-base leading-7 text-slate-700 dark:text-slate-200 max-w-3xl">
        {reply.body}
      </p>
      <LinkList videoLinks={reply.videoLinks} />
      <AttachmentList uploads={reply.uploads} />

      {deleteError && (
        <p role="alert" className="mt-2 border-l-2 border-danger-500 pl-3 text-sm text-danger-700 dark:text-danger-300">
          {deleteError}
        </p>
      )}

      {canEdit && editing && (
        <form action={editFormAction} className="mt-3 space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <label className={nativeLabelClass}>
            Edit Reply <span className="text-danger">*</span>
            <textarea
              name="body"
              defaultValue={editState.values?.body ?? reply.body}
              rows={4}
              required
              maxLength={20_000}
              className={nativeTextareaClass}
            />
          </label>
          <label className={nativeLabelClass}>
            Video links
            <textarea
              name="videoLinks"
              defaultValue={editState.values?.videoLinks ?? formatVideoLinks(reply.videoLinks)}
              rows={3}
              placeholder="Walkthrough|https://youtu.be/abc123|01:30|What it shows"
              className={nativeTextareaClass}
            />
          </label>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            One per line: title|https://url|timestamp|summary. Leave empty to remove all links.
          </p>
          {editError && (
            <p role="alert" className="border-l-2 border-danger-500 pl-3 text-sm text-danger-700 dark:text-danger-300">
              {editError}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={secondaryButtonClass}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={editPending}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {editPending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}
