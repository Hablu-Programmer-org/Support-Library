"use client";

import type { FormEvent } from "react";
import { useActionState, useRef, useState } from "react";

import { addReplyAction, type ReplyFormState } from "@/actions/replies";
import type { IssueEditorApi } from "@/components/issues/issue-editor";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import { ReplyBodyField, replyBodyProblem } from "@/components/issues/reply-body-field";
import { AttachmentField } from "@/components/shared/attachment-field";

const INITIAL_STATE: ReplyFormState = {};

/** `crypto.randomUUID` needs a secure context; the server falls back if it is missing. */
const newOperationId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return "";
  }
};

/**
 * The one message worth showing for a failed submission. `_form` carries the
 * generic/rate-limit/session errors, `uploads` a rejected file, `body` the
 * validation message — the composer is compact, so they share one alert.
 */
const firstError = (state: ReplyFormState) =>
  state.fieldErrors?._form?.[0] ??
  state.fieldErrors?.uploads?.[0] ??
  state.fieldErrors?.body?.[0];

export function ReplyComposer({
  issueId,
  csrfToken = "",
  returnTo,
}: {
  issueId: string;
  csrfToken?: string;
  /** List URL to return to after the reply is saved (filters + page). */
  returnTo?: string;
}) {
  const [state, formAction] = useActionState(addReplyAction.bind(null, issueId), INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const operationIdRef = useRef<HTMLInputElement>(null);
  // Fingerprint of the payload the current operation id belongs to. A retry of
  // the *same* text must reuse the id (that is what makes a double submit
  // idempotent), while new text must get a new one — the server rejects a reused
  // operation id that carries a different payload.
  const submittedPayloadRef = useRef<string | null>(null);
  const editorApi = useRef<IssueEditorApi | null>(null);
  // Kept in state, so a rejected response is still in the editor. The page
  // remounts this composer once the reply exists (keyed by the thread).
  const [body, setBody] = useState("");
  const [bodyError, setBodyError] = useState<string | null>(null);
  // A screenshot pasted into the editor must not land in a closed section.
  const [extrasOpen, setExtrasOpen] = useState(false);

  const ensureOperationId = () => {
    const input = operationIdRef.current;
    if (!input) return;

    const form = formRef.current;
    const payload =
      (form?.elements.namedItem("body") as HTMLTextAreaElement | null)?.value ?? "";

    if (!input.value || submittedPayloadRef.current !== payload) {
      input.value = newOperationId();
      submittedPayloadRef.current = payload;
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    // The body lives in a hidden input, which the browser never validates.
    const problem = replyBodyProblem(body);
    if (problem) {
      event.preventDefault();
      setBodyError(problem);
      editorApi.current?.focus();
      return;
    }
    ensureOperationId();
  };

  const onBodyChange = (value: string) => {
    setBody(value);
    if (bodyError && !replyBodyProblem(value)) setBodyError(null);
  };

  const error = firstError(state);

  return (
    <section>
      <h3 className="text-sm font-semibold text-slate-950 dark:text-white">
        Write a response
      </h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        The fix first, then the steps.
      </p>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={onSubmit}
        className="mt-4 space-y-3"
      >
        <input ref={operationIdRef} type="hidden" name="operationId" />
        <input type="hidden" name="csrfToken" value={csrfToken} />
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        <ReplyBodyField
          id="reply-body"
          name="body"
          label="Response"
          required
          value={body}
          onChange={onBodyChange}
          error={bodyError}
          apiRef={editorApi}
        />
        <details
          open={extrasOpen}
          onToggle={(event) => setExtrasOpen(event.currentTarget.open)}
          className="border-t border-slate-200 pt-3 dark:border-slate-800"
        >
          <summary className="cursor-pointer text-sm font-semibold">Add attachments</summary>
          <div className="mt-3 grid gap-3">
            <AttachmentField onCountChange={(count) => count > 0 && setExtrasOpen(true)} />
          </div>
        </details>
        <div className="ml-auto w-full sm:w-44">
          <PendingSubmitButton label="Add response" pendingLabel="Adding..." />
        </div>
        {error && (
          <p role="alert" className="border-l-2 border-danger-500 pl-3 text-sm text-danger-700 dark:text-danger-600">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
