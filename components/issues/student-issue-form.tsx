"use client";

import { useActionState, useRef, useState } from "react";

import { createStudentIssueAction } from "@/actions/issues";
import { CheckCircleIcon, HelpCircleIcon } from "@/components/icons";
import { AttachmentField } from "@/components/shared/attachment-field";
import { nativeFieldClass, nativeTextareaClass } from "@/lib/config/fields";

type StudentIssueFormProps = {
  csrfToken: string;
  /** Shown so the student can confirm which account the request is filed under. */
  email?: string | null;
};

export function StudentIssueForm({ csrfToken, email }: StudentIssueFormProps) {
  const [state, formAction, pending] = useActionState(createStudentIssueAction, {
    fieldErrors: {},
  });
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [fileLinks, setFileLinks] = useState("");
  const [videoLinks, setVideoLinks] = useState("");
  const operationIdRef = useRef<HTMLInputElement>(null);

  const ensureOperationId = () => {
    if (operationIdRef.current && !operationIdRef.current.value) {
      operationIdRef.current.value = crypto.randomUUID();
    }
  };

  const formError = state.fieldErrors?._form?.[0];

  return (
    <form
      action={formAction}
      className="space-y-5"
      onSubmit={ensureOperationId}
      aria-describedby={formError ? "student-issue-error" : undefined}
    >
      <input ref={operationIdRef} type="hidden" name="operationId" />
      <input type="hidden" name="csrfToken" value={csrfToken} />

      {formError && (
        <p
          id="student-issue-error"
          className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-300"
          role="alert"
        >
          {formError}
        </p>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-7">
          <span
            aria-hidden="true"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300"
          >
            <HelpCircleIcon size={19} />
          </span>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
            Describe your problem
          </h2>
        </div>

        <div className="space-y-4 px-5 py-6 sm:px-7 sm:py-7">
          {email && (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
              Submitting as <span className="font-medium">{email}</span>. The support team
              will reach you at this address.
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Title <span className="text-danger" aria-hidden="true">*</span>
            </span>
            <input
              className={nativeFieldClass}
              name="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              required
              minLength={5}
              maxLength={200}
              aria-invalid={state.fieldErrors?.title?.[0] ? "true" : "false"}
              placeholder="e.g., Video lecture is not loading"
            />
            {state.fieldErrors?.title?.[0] ? (
              <p className="text-sm text-danger-600 dark:text-danger-400" role="alert">
                {state.fieldErrors.title[0]}
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                A short summary, at least 5 characters.
              </p>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Problem details <span className="text-danger" aria-hidden="true">*</span>
            </span>
            <textarea
              className={nativeTextareaClass}
              name="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              required
              rows={7}
              minLength={5}
              maxLength={20_000}
              aria-invalid={state.fieldErrors?.question?.[0] ? "true" : "false"}
              placeholder="Explain what you were doing, what you expected, and what happened instead."
            />
            {state.fieldErrors?.question?.[0] ? (
              <p className="text-sm text-danger-600 dark:text-danger-400" role="alert">
                {state.fieldErrors.question[0]}
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Include the steps to reproduce the problem if you can.
              </p>
            )}
          </label>

          <div className="flex flex-col gap-1.5">
            <AttachmentField
              label="Screenshots (optional)"
              description="PNG, JPEG, GIF or WebP, up to 3 images of 5 MB each. Screenshots are only visible to the support team."
            />
            {state.fieldErrors?.uploads?.[0] && (
              <p className="text-sm text-danger-600 dark:text-danger-400" role="alert">
                {state.fieldErrors.uploads[0]}
              </p>
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Image / file links <span className="text-slate-400 dark:text-slate-500">(optional)</span>
            </span>
            <textarea
              className={nativeTextareaClass}
              name="fileLinks"
              value={fileLinks}
              onChange={(event) => setFileLinks(event.target.value)}
              rows={2}
              aria-invalid={state.fieldErrors?.fileLinks?.[0] ? "true" : "false"}
              placeholder={"Screenshot|https://example.com/image.png|image|What the error looks like"}
            />
            {state.fieldErrors?.fileLinks?.[0] ? (
              <p className="text-sm text-danger-600 dark:text-danger-400" role="alert">
                {state.fieldErrors.fileLinks[0]}
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                One per line: <span className="font-medium">Title|https://link</span> (optionally add
                |image or |pdf and a short note). Use this for files that are already hosted
                somewhere, or for formats the uploader does not accept.
              </p>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Video links <span className="text-slate-400 dark:text-slate-500">(optional)</span>
            </span>
            <textarea
              className={nativeTextareaClass}
              name="videoLinks"
              value={videoLinks}
              onChange={(event) => setVideoLinks(event.target.value)}
              rows={2}
              aria-invalid={state.fieldErrors?.videoLinks?.[0] ? "true" : "false"}
              placeholder={"Walkthrough|https://youtu.be/videoId|01:30|Shows the bug"}
            />
            {state.fieldErrors?.videoLinks?.[0] ? (
              <p className="text-sm text-danger-600 dark:text-danger-400" role="alert">
                {state.fieldErrors.videoLinks[0]}
              </p>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                One per line: <span className="font-medium">Title|https://link</span> (optionally add
                |timestamp and a summary).
              </p>
            )}
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
      >
        <CheckCircleIcon size={18} />
        {pending ? "Submitting..." : "Submit request"}
      </button>
    </form>
  );
}
