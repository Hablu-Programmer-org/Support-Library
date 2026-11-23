"use client";

import { useActionState, useState } from "react";

import { deleteReplyAction, editReplyAction, type ReplyFormState } from "@/actions/replies";
import { CheckCircleIcon, PencilIcon, TrashIcon } from "@/components/icons";
import { AttachmentList, formatByteSize } from "@/components/shared/attachment-list";
import { LinkList } from "@/components/shared/link-list";
import { nativeLabelClass, nativeTextareaClass } from "@/lib/config/fields";
import { formatSupportDate } from "@/lib/format-date";
import { formatVideoLinks } from "@/lib/format-links";
import { RichText } from "@/lib/rich-text";
import type { SupportReplyListItem } from "@/lib/services/replies";
import { replyAnchorId } from "@/lib/issue-solution";

const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800";

const INITIAL_STATE: ReplyFormState = {};

const cardBase = "scroll-mt-24 rounded-2xl border p-5 shadow-sm sm:p-6";

/** Solution: the answer the team stands behind, set apart with an emerald edge. */
export const articleClass = (variant: "solution" | "response", isStaffReply: boolean) =>
  variant === "solution"
    ? `${cardBase} border-emerald-300 border-l-4 border-l-emerald-500 bg-white dark:border-emerald-500/30 dark:border-l-emerald-400 dark:bg-slate-900/70`
    : isStaffReply
      ? `${cardBase} border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/70`
      : `${cardBase} border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/40`;

/**
 * Who wrote the reply: an explicit label wins, then the staff member's name
 * (plain "Staff" when the account has no name), then the student's name.
 */
export const replyAuthorLabel = (
  reply: Pick<SupportReplyListItem, "isStaffReply" | "authorName">,
  authorLabel?: string,
) => {
  if (authorLabel) return authorLabel;
  const name = reply.authorName?.trim();
  if (reply.isStaffReply) return name || "Staff";
  return name || "You";
};

export const authorInitial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

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
  variant = "response",
  authorLabel,
}: {
  issueId: string;
  reply: SupportReplyListItem;
  canEdit: boolean;
  csrfToken?: string;
  /** `solution` is the answer the team stands behind; `response` is follow-up chatter. */
  variant?: "solution" | "response";
  authorLabel?: string;
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

  const author = replyAuthorLabel(reply, authorLabel);

  return (
    <article
      id={replyAnchorId(reply.id)}
      data-testid={`reply-${reply.id}`}
      data-variant={variant}
      className={articleClass(variant, reply.isStaffReply)}
    >
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            aria-hidden="true"
            className={`flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
              reply.isStaffReply
                ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200"
                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            {authorInitial(author)}
          </span>
          <p className="min-w-0 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="wrap-break-word text-sm font-semibold text-slate-900 dark:text-white">
                {author}
              </span>
              {reply.isStaffReply && author !== "Staff" ? (
                <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[11px] font-semibold text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-200">
                  Staff
                </span>
              ) : null}
              {variant === "solution" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
                  <CheckCircleIcon size={12} aria-hidden="true" />
                  Solution
                </span>
              ) : null}
            </span>
            <span className="mt-0.5 block">
              {reply.createdAt ? (
                <time dateTime={new Date(reply.createdAt).toISOString()}>
                  {formatSupportDate(reply.createdAt)}
                </time>
              ) : null}
              {reply.editedAt ? " · edited" : ""}
            </span>
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Edit"
              aria-expanded={editing}
              title="Edit reply"
              onClick={() => setEditing((value) => !value)}
              className="inline-flex size-10 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
                className="inline-flex size-10 items-center justify-center rounded-lg text-slate-400 transition hover:bg-danger-50 hover:text-danger-600 focus-visible:bg-danger-50 focus-visible:text-danger-600 dark:text-slate-500 dark:hover:bg-danger-50/40 dark:hover:text-danger-600 dark:focus-visible:bg-danger-50/40 dark:focus-visible:text-danger-600"
              >
                <TrashIcon size={16} />
              </button>
            </form>
          </div>
        )}
      </header>

      <RichText
        text={reply.body}
        className={
          variant === "solution"
            ? "text-base leading-8 text-slate-800 dark:text-slate-100"
            : "text-sm leading-7 text-slate-700 dark:text-slate-300"
        }
      />
      <LinkList videoLinks={reply.videoLinks} />
      <AttachmentList uploads={reply.uploads} />

      {deleteError && (
        <p role="alert" className="mt-2 border-l-2 border-danger-500 pl-3 text-sm text-danger-700 dark:text-danger-600">
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
            <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
              Use ### for headings, - for lists, **text** for bold, `code`, and [label](https://example.com) for links.
            </span>
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
          {reply.uploads.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Existing attachments
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tick an image to remove it when you save. Removing a picture puts the case back
                into review before it can appear in the Student Library again.
              </p>
              <ul className="flex flex-wrap gap-3">
                {reply.uploads.map((upload) => {
                  const src = `/api/attachments/${upload.id}`;
                  return (
                    <li key={upload.id} className="w-36 space-y-1">
                      <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block size-36 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950"
                        aria-label={`Open ${upload.originalName}`}
                      >
                        {/* A direct image request carries the staff session cookie;
                            next/image's optimizer request would not. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={upload.originalName}
                          loading="lazy"
                          decoding="async"
                          className="size-full object-cover"
                        />
                      </a>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div
                            className="truncate text-sm text-slate-700 dark:text-slate-300"
                            title={upload.originalName}
                          >
                            {upload.originalName}
                          </div>
                          <div className="text-xs text-slate-400 dark:text-slate-500">
                            {formatByteSize(upload.byteSize)}
                          </div>
                        </div>
                        <label className="flex shrink-0 items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <input
                            type="checkbox"
                            name="removeUploadIds"
                            value={upload.id}
                            className="h-4 w-4 rounded border-slate-300 text-danger focus:ring-danger-500"
                          />
                          Remove
                        </label>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {editError && (
            <p role="alert" className="border-l-2 border-danger-500 pl-3 text-sm text-danger-700 dark:text-danger-600">
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
