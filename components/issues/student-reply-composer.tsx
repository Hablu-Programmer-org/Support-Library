"use client";

import { type FormEvent, useActionState, useRef, useState } from "react";

import { addStudentReplyAction, type ReplyFormState } from "@/actions/replies";
import type { IssueEditorApi } from "@/components/issues/issue-editor";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import { ReplyBodyField, replyBodyProblem } from "@/components/issues/reply-body-field";
import { AttachmentField } from "@/components/shared/attachment-field";
import { nativeLabelClass, nativeTextareaClass } from "@/lib/config/fields";

const INITIAL_STATE: ReplyFormState = {};

const newOperationId = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return "";
  }
};

const firstError = (state: ReplyFormState) =>
  state.fieldErrors?._form?.[0] ??
  state.fieldErrors?.uploads?.[0] ??
  state.fieldErrors?.body?.[0] ??
  state.fieldErrors?.videoLinks?.[0];

export function StudentReplyComposer({
  issueId,
  csrfToken = "",
}: {
  issueId: string;
  csrfToken?: string;
}) {
  const [state, formAction] = useActionState(addStudentReplyAction.bind(null, issueId), INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const operationIdRef = useRef<HTMLInputElement>(null);
  const submittedPayloadRef = useRef<string | null>(null);
  const editorApi = useRef<IssueEditorApi | null>(null);
  // Kept in state, so a rejected message is still in the editor. The page
  // remounts this composer once the reply exists (keyed by the thread).
  const [body, setBody] = useState("");
  const [bodyError, setBodyError] = useState<string | null>(null);
  // A screenshot pasted into the editor must not land in a closed section.
  const [extrasOpen, setExtrasOpen] = useState(false);

  const ensureOperationId = () => {
    const input = operationIdRef.current;
    if (!input) return;

    const form = formRef.current;
    const payload = form
      ? `${(form.elements.namedItem("body") as HTMLTextAreaElement | null)?.value ?? ""}|${
          (form.elements.namedItem("videoLinks") as HTMLTextAreaElement | null)?.value ?? ""
        }`
      : "";

    if (!input.value || submittedPayloadRef.current !== payload) {
      input.value = newOperationId();
      submittedPayloadRef.current = payload;
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    // The message lives in a hidden input, which the browser never validates.
    const problem = replyBodyProblem(body, { emptyMessage: "Write your message before sending." });
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
    <section className="border-t border-slate-200 pt-6 dark:border-slate-800">
      <h3 className="text-sm font-semibold text-slate-950 dark:text-white">Reply to the support team</h3>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Add only the new information. Your message will reopen a solved issue.
      </p>
      <form ref={formRef} action={formAction} onSubmit={onSubmit} className="mt-4 space-y-3">
        <input ref={operationIdRef} type="hidden" name="operationId" />
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <ReplyBodyField
          id="student-reply-body"
          name="body"
          label="Message"
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
          <summary className="cursor-pointer text-sm font-semibold">Add attachments or video links</summary>
          <div className="mt-3 grid gap-3">
            <AttachmentField onCountChange={(count) => count > 0 && setExtrasOpen(true)} />
            {/* `defaultValue` from the returned state: React resets the form
                after a form action runs, which would otherwise wipe it. */}
            <label className={nativeLabelClass}>
              <span>Video links</span>
              <textarea
                name="videoLinks"
                rows={2}
                defaultValue={state.values?.videoLinks ?? ""}
                placeholder="Walkthrough|https://youtu.be/abc123|01:30|What it shows"
                className={nativeTextareaClass}
              />
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                One per line: title|https://url|timestamp|summary
              </span>
            </label>
          </div>
        </details>
        <div className="ml-auto w-full sm:w-44">
          <PendingSubmitButton label="Send reply" pendingLabel="Sending..." />
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