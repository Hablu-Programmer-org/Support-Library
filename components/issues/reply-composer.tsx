import type { TextareaHTMLAttributes } from "react";

import { addReplyAction } from "@/actions/replies";
import { nativeLabelClass, nativeTextareaClass } from "@/lib/config/fields";

export function ReplyComposer({ issueId }: { issueId: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <form action={addReplyAction.bind(null, issueId)} className="space-y-3">
            <input type="hidden" name="isInternalNote" value="false" />
            <TextAreaField name="body" label="Write a Reply" rows={4} required maxLength={20_000} />
            <details className="rounded-2xl border border-slate-200 p-3 dark:border-slate-700">
              <summary className="cursor-pointer text-sm font-semibold">External file/video links</summary>
              <div className="mt-3 grid gap-3">
                <TextAreaField name="fileLinks" label="File links" rows={2} description="One per line: title|https://url|type|note" />
                <TextAreaField name="videoLinks" label="Video links" rows={2} description="One per line: title|https://url|timestamp|summary" />
              </div>
            </details>
            <div className="flex justify-end">
              <button type="submit" className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600">
                Add Reply
              </button>
            </div>
          </form>
      </section>

      <section className="rounded-2xl border border-warning-200 bg-warning-50/50 p-4 dark:border-warning-900/40 dark:bg-warning-950/20">
          <form action={addReplyAction.bind(null, issueId)} className="space-y-3">
            <input type="hidden" name="isInternalNote" value="true" />
            <TextAreaField name="body" label="Internal Note" rows={4} required maxLength={20_000} />
            <details className="rounded-2xl border border-warning-200 p-3 dark:border-warning-900/40">
              <summary className="cursor-pointer text-sm font-semibold">Internal links</summary>
              <div className="mt-3 grid gap-3">
                <TextAreaField name="fileLinks" label="File links" rows={2} description="One per line: title|https://url|type|note" />
                <TextAreaField name="videoLinks" label="Video links" rows={2} description="One per line: title|https://url|timestamp|summary" />
              </div>
            </details>
            <p className="text-xs text-warning-700 dark:text-warning-300">
              Only staff can see this note. It is hidden from students.
            </p>
            <div className="flex justify-end">
              <button type="submit" className="inline-flex items-center justify-center rounded-xl bg-warning-100 px-4 py-2 text-sm font-semibold text-warning-700 transition hover:bg-warning-200 dark:bg-warning-950/50 dark:text-warning-200 dark:hover:bg-warning-900/60">
                Add Internal Note
              </button>
            </div>
          </form>
      </section>
    </div>
  );
}

function TextAreaField({ label, description, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; description?: string }) {
  return (
    <label className={nativeLabelClass}>
      {label} {props.required && <span className="text-danger">*</span>}
      <textarea {...props} className={nativeTextareaClass} />
      {description && <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{description}</span>}
    </label>
  );
}