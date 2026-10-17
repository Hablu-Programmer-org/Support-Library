"use client";

import type { TextareaHTMLAttributes } from "react";
import { useRef } from "react";

import { addReplyAction } from "@/actions/replies";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import { AttachmentField } from "@/components/shared/attachment-field";
import { nativeLabelClass, nativeTextareaClass } from "@/lib/config/fields";

export function ReplyComposer({ issueId, csrfToken = "" }: { issueId: string; csrfToken?: string }) {
  const operationIdRef = useRef<HTMLInputElement>(null);

  const ensureOperationId = () => {
    if (operationIdRef.current && !operationIdRef.current.value) {
      operationIdRef.current.value = crypto.randomUUID();
    }
  };

  return (
    <section className="py-6">
      <h3 className="font-semibold text-slate-950 dark:text-white">Write a public response</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Students can read this response after the issue is reviewed and published.
      </p>
      <form action={addReplyAction.bind(null, issueId)} onSubmit={ensureOperationId} className="mt-4 space-y-3">
        <input ref={operationIdRef} type="hidden" name="operationId" />
        <input type="hidden" name="csrfToken" value={csrfToken} />
        <TextAreaField name="body" label="Response" rows={5} required maxLength={20_000} />
        <details className="border-t border-slate-200 pt-3 dark:border-slate-800">
          <summary className="cursor-pointer text-sm font-semibold">Add attachments or video links</summary>
          <div className="mt-3 grid gap-3">
            <AttachmentField />
            <TextAreaField name="videoLinks" label="Video links" rows={2} description="One per line: title|https://url|timestamp|summary" />
          </div>
        </details>
        <div className="ml-auto w-full sm:w-44">
          <PendingSubmitButton label="Add response" pendingLabel="Adding..." />
        </div>
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
