import type { TextareaHTMLAttributes } from "react";

import { addReplyAction } from "@/actions/replies";
import { PendingSubmitButton } from "@/components/issues/pending-submit-button";
import { nativeLabelClass, nativeTextareaClass } from "@/lib/config/fields";

export function ReplyComposer({ issueId }: { issueId: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
      <h3 className="font-semibold text-slate-950 dark:text-white">Write a public response</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Students can read this response after the issue is reviewed and published.
      </p>
      <form action={addReplyAction.bind(null, issueId)} className="mt-4 space-y-3">
        <TextAreaField name="body" label="Response" rows={5} required maxLength={20_000} />
        <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
          <summary className="cursor-pointer text-sm font-semibold">Add file or video links</summary>
          <div className="mt-3 grid gap-3">
            <TextAreaField name="fileLinks" label="File links" rows={2} description="One per line: title|https://url|type|note" />
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
