"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useActionState,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { deleteReplyAction, editReplyAction, type ReplyFormState } from "@/actions/replies";
import { CheckCircleIcon, PencilIcon, TrashIcon } from "@/components/icons";
import type { IssueEditorApi } from "@/components/issues/issue-editor";
import { ReplyBodyField, replyBodyProblem } from "@/components/issues/reply-body-field";
import { AttachmentField } from "@/components/shared/attachment-field";
import { AttachmentList } from "@/components/shared/attachment-list";
import { LinkList } from "@/components/shared/link-list";
import { cn } from "@/lib/cn";
import { nativeLabelClass, nativeTextareaClass } from "@/lib/config/fields";
import { formatSupportDate } from "@/lib/format-date";
import { formatVideoLinks } from "@/lib/format-links";
import { RichText } from "@/lib/rich-text";
import type { SupportReplyListItem } from "@/lib/services/replies";
import { replyAnchorId } from "@/lib/issue-solution";
import { primaryButtonClass, secondaryButtonClass, subtleButtonClass } from "@/lib/ui";

const INITIAL_STATE: ReplyFormState = {};

const noopSubscribe = () => () => {};
const isApplePlatform = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

const iconButtonClass =
  "inline-flex size-10 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200";

const dangerButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-danger-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger-500/40 disabled:opacity-60";

const toIso = (value: Date | string | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
};

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
 *
 * Editing happens in place: the read view is swapped for the editor inside the
 * same card, so the text never shows twice. Esc cancels, Ctrl/⌘+Enter saves,
 * and leaving with unsaved changes asks first.
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
  const apple = useSyncExternalStore(noopSubscribe, isApplePlatform, () => false);
  const savedLinks = formatVideoLinks(reply.videoLinks);

  const [editing, setEditing] = useState(false);
  // The editor's Markdown. Filled from the saved reply each time the editor
  // opens; a rejected save keeps what was typed.
  const [editBody, setEditBody] = useState(reply.body);
  const [editLinks, setEditLinks] = useState(savedLinks);
  const [editBodyError, setEditBodyError] = useState<string | null>(null);
  const [removeCount, setRemoveCount] = useState(0);
  const [newImageCount, setNewImageCount] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const editorApi = useRef<IssueEditorApi | null>(null);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  // Which header button gets focus back once the editor / delete row closes.
  const restoreFocus = useRef<"edit" | "delete" | null>(null);

  const dirty =
    editBody !== reply.body || editLinks !== savedLinks || removeCount > 0 || newImageCount > 0;

  const openEditor = () => {
    setEditBody(reply.body);
    setEditLinks(savedLinks);
    setEditBodyError(null);
    setRemoveCount(0);
    setNewImageCount(0);
    setConfirmDiscard(false);
    setConfirmDelete(false);
    setShowSaved(false);
    setEditing(true);
  };

  const closeEditor = () => {
    setEditing(false);
    setConfirmDiscard(false);
    restoreFocus.current = "edit";
  };

  const closeDeleteConfirm = () => {
    setConfirmDelete(false);
    restoreFocus.current = "delete";
  };

  const requestCancel = () => {
    if (dirty) setConfirmDiscard(true);
    else closeEditor();
  };

  const onEditSubmit = (event: FormEvent<HTMLFormElement>) => {
    // The body lives in a hidden input, which the browser never validates.
    const problem = replyBodyProblem(editBody, { emptyMessage: "A reply can't be empty. Delete it instead." });
    if (problem) {
      event.preventDefault();
      setEditBodyError(problem);
      editorApi.current?.focus();
      return;
    }
    // When the save succeeds the editor closes; focus goes back to the pencil.
    restoreFocus.current = "edit";
  };

  const onEditKeyDown = (event: KeyboardEvent<HTMLFormElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (confirmDiscard) setConfirmDiscard(false);
      else requestCancel();
    } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      event.currentTarget.requestSubmit();
    }
  };

  const onEditFormChange = (event: FormEvent<HTMLFormElement>) => {
    const target = event.target as HTMLInputElement;
    if (target.name === "removeUploadIds") {
      setRemoveCount(
        event.currentTarget.querySelectorAll('input[name="removeUploadIds"]:checked').length,
      );
    }
  };

  const onEditBodyChange = (value: string) => {
    setEditBody(value);
    if (editBodyError && !replyBodyProblem(value)) setEditBodyError(null);
  };
  const [editState, editFormAction, editPending] = useActionState(
    editReplyAction.bind(null, issueId, reply.id),
    INITIAL_STATE,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteReplyAction.bind(null, issueId, reply.id),
    INITIAL_STATE,
  );

  // The editor closes on a confirmed save, so a failure leaves the text in place
  // with the reason beside it. Adjusted during render (React's documented
  // pattern for deriving state from a new result) rather than in an effect.
  const [savedMessage, setSavedMessage] = useState<string | undefined>(undefined);
  if (editState.message !== savedMessage) {
    setSavedMessage(editState.message);
    if (editState.message) {
      setEditing(false);
      setConfirmDiscard(false);
      setShowSaved(true);
    }
  }

  // The header buttons only exist again after the commit, so focus them here.
  useEffect(() => {
    const target = restoreFocus.current;
    if (!target || editing || confirmDelete) return;
    restoreFocus.current = null;
    (target === "edit" ? editButtonRef : deleteButtonRef).current?.focus();
  }, [editing, confirmDelete]);

  useEffect(() => {
    if (!showSaved) return;
    const timer = setTimeout(() => setShowSaved(false), 3000);
    return () => clearTimeout(timer);
  }, [showSaved]);

  const editError =
    editState.fieldErrors?._form?.[0] ??
    editState.fieldErrors?.videoLinks?.[0] ??
    editState.fieldErrors?.uploads?.[0];
  const deleteError = deleteState.fieldErrors?._form?.[0];

  const author = replyAuthorLabel(reply, authorLabel);
  const keptImages = reply.uploads.length - removeCount;

  return (
    <article
      id={replyAnchorId(reply.id)}
      data-testid={`reply-${reply.id}`}
      data-variant={variant}
      data-editing={editing ? "true" : undefined}
      className={cn(articleClass(variant, reply.isStaffReply), editing && "ring-2 ring-primary/40")}
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
              {editing ? (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary-700 dark:text-primary-300">
                  Editing
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
              <span aria-live="polite">
                {showSaved ? (
                  <span className="ml-2 inline-flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircleIcon size={12} aria-hidden="true" />
                    Saved
                  </span>
                ) : null}
              </span>
            </span>
          </p>
        </div>

        {canEdit && !editing && !confirmDelete && (
          <div className="flex items-center gap-1">
            <button
              ref={editButtonRef}
              type="button"
              aria-label="Edit"
              title="Edit reply"
              onClick={openEditor}
              className={iconButtonClass}
            >
              <PencilIcon size={16} />
            </button>
            <button
              ref={deleteButtonRef}
              type="button"
              aria-label="Delete"
              title="Delete reply"
              onClick={() => setConfirmDelete(true)}
              className={cn(
                iconButtonClass,
                "text-slate-400 hover:bg-danger-50 hover:text-danger-600 dark:text-slate-500 dark:hover:bg-danger-50/40 dark:hover:text-danger-600",
              )}
            >
              <TrashIcon size={16} />
            </button>
          </div>
        )}
      </header>

      {canEdit && confirmDelete && (
        <form
          action={deleteFormAction}
          onKeyDown={(event) => {
            if (event.key === "Escape") closeDeleteConfirm();
          }}
          className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-danger-300 bg-danger-50 px-3 py-2 dark:border-danger-500/40 dark:bg-danger-500/10"
        >
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <p className="flex-1 text-sm font-medium text-danger-800 dark:text-danger-200">
            Delete this reply? This cannot be undone.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              autoFocus
              onClick={closeDeleteConfirm}
              className={subtleButtonClass}
            >
              Keep reply
            </button>
            <button type="submit" disabled={deletePending} className={dangerButtonClass}>
              {deletePending ? "Deleting…" : "Delete reply"}
            </button>
          </div>
        </form>
      )}

      {!editing && (
        <>
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
        </>
      )}

      {deleteError && (
        <p role="alert" className="mt-2 border-l-2 border-danger-500 pl-3 text-sm text-danger-700 dark:text-danger-600">
          {deleteError}
        </p>
      )}

      {canEdit && editing && (
        <form
          action={editFormAction}
          onSubmit={onEditSubmit}
          onKeyDown={onEditKeyDown}
          onChange={onEditFormChange}
          className="space-y-4"
        >
          <input type="hidden" name="csrfToken" value={csrfToken} />
          <input type="hidden" name="expectedUpdatedAt" value={toIso(reply.updatedAt)} />
          <ReplyBodyField
            id={`reply-edit-${reply.id}`}
            name="body"
            label="Edit reply"
            required
            value={editBody}
            onChange={onEditBodyChange}
            error={editBodyError}
            apiRef={editorApi}
            onReady={() => editorApi.current?.focus()}
          />

          {reply.uploads.length > 0 && (
            <div className="space-y-2">
              <AttachmentList
                bare
                title="Images"
                uploads={reply.uploads}
                renderAction={(upload) => (
                  <label className="inline-flex min-h-9 w-fit cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      name="removeUploadIds"
                      value={upload.id}
                      aria-label={`Remove ${upload.originalName}`}
                      className="h-4 w-4 rounded border-slate-300 text-danger focus:ring-danger-500"
                    />
                    Remove
                  </label>
                )}
              />
              {removeCount > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Removing an image sends the case back to review.
                </p>
              )}
            </div>
          )}

          {/* Same disclosure as the composer; open when the reply already has links. */}
          <details
            open={savedLinks.length > 0 || undefined}
            className="border-t border-slate-200 pt-3 dark:border-slate-800"
          >
            <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">
              Add images or video links
            </summary>
            <div className="mt-3 grid gap-3">
              <AttachmentField
                label="Add images"
                existingCount={keptImages}
                onCountChange={setNewImageCount}
                description="PNG, JPEG, GIF or WebP · 5 MB each"
              />
              <label className={nativeLabelClass}>
                Video links
                <textarea
                  name="videoLinks"
                  value={editLinks}
                  onChange={(event) => setEditLinks(event.target.value)}
                  rows={2}
                  placeholder="Walkthrough|https://youtu.be/abc123|01:30|What it shows"
                  className={nativeTextareaClass}
                />
                <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                  One per line: title|https://url|timestamp|summary
                </span>
              </label>
            </div>
          </details>

          {editError && (
            <p role="alert" className="border-l-2 border-danger-500 pl-3 text-sm text-danger-700 dark:text-danger-600">
              {editError}
            </p>
          )}

          {confirmDiscard ? (
            <div
              role="group"
              aria-label="Discard changes"
              className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 dark:border-amber-500/30 dark:bg-amber-500/10"
            >
              <p className="flex-1 text-sm text-amber-800 dark:text-amber-200">Discard your changes?</p>
              <button
                type="button"
                autoFocus
                onClick={() => setConfirmDiscard(false)}
                className={subtleButtonClass}
              >
                Keep editing
              </button>
              <button type="button" onClick={closeEditor} className={secondaryButtonClass}>
                Discard
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button type="button" onClick={requestCancel} className={secondaryButtonClass}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={editPending}
                aria-keyshortcuts={apple ? "Meta+Enter" : "Control+Enter"}
                className={primaryButtonClass}
              >
                {editPending ? "Saving…" : "Save"}
                <kbd
                  aria-hidden="true"
                  className="hidden rounded bg-white/20 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white md:inline-flex"
                >
                  {apple ? "⌘↵" : "Ctrl+↵"}
                </kbd>
              </button>
            </div>
          )}
        </form>
      )}
    </article>
  );
}
