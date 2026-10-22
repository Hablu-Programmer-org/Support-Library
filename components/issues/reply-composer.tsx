"use client";

import type { TextareaHTMLAttributes } from "react";
import { useActionState, useRef } from "react";

import { addReplyAction, type ReplyFormState } from "@/actions/replies";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import { AttachmentField } from "@/components/shared/attachment-field";
import { nativeLabelClass, nativeTextareaClass } from "@/lib/config/fields";

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
  state.fieldErrors?.body?.[0] ??
  state.fieldErrors?.videoLinks?.[0];

export function ReplyComposer({ issueId, csrfToken = "" }: { issueId: string; csrfToken?: string }) {
  const [state, formAction] = useActionState(addReplyAction.bind(null, issueId), INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);
  const operationIdRef = useRef<HTMLInputElement>(null);
  // Fingerprint of the payload the current operation id belongs to. A retry of
  // the *same* text must reuse the id (that is what makes a double submit
  // idempotent), while new text must get a new one — the server rejects a reused
  // operation id that carries a different payload.
  const submittedPayloadRef = useRef<string | null>(null);

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

  const error = firstError(state);

  return (
    <section className="py-6">
      <h3 className="font-semibold text-slate-950 dark:text-white">Write a public response</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Students can read this response after the issue is reviewed and published.
      </p>
      <form
        ref={formRef}
        action={formAction}
        onSubmit={ensureOperationId}
        className="mt-4 space-y-3"
      >
        <input ref={operationIdRef} type="hidden" name="operationId" />
        <input type="hidden" name="csrfToken" value={csrfToken} />
        {/* `defaultValue` from the returned state: React resets the form after a
            form action runs, which would otherwise wipe a failed response. */}
        <TextAreaField
          name="body"
          label="Response"
          rows={5}
          required
          maxLength={20_000}
          defaultValue={state.values?.body ?? ""}
        />
        <details className="border-t border-slate-200 pt-3 dark:border-slate-800">
          <summary className="cursor-pointer text-sm font-semibold">Add attachments or video links</summary>
          <div className="mt-3 grid gap-3">
            <AttachmentField />
            <TextAreaField
              name="videoLinks"
              label="Video links"
              rows={2}
              description="One per line: title|https://url|timestamp|summary"
              defaultValue={state.values?.videoLinks ?? ""}
            />
          </div>
        </details>
        <div className="ml-auto w-full sm:w-44">
          <PendingSubmitButton label="Add response" pendingLabel="Adding..." />
        </div>
        {error && (
          <p role="alert" className="border-l-2 border-danger-500 pl-3 text-sm text-danger-700 dark:text-danger-300">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

function TextAreaField({ label, description, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; description?: string }) {
  return (
    <label className={nativeLabelClass}>
      <span>
        {label} {props.required && <span className="text-danger">*</span>}
      </span>
      <textarea {...props} className={nativeTextareaClass} />
      {description && <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{description}</span>}
    </label>
  );
}
