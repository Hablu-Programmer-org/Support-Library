import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

import { createCaseAction, updateCaseAction } from "@/actions/cases";
import { StudentFields } from "@/components/cases/student-fields";
import { nativeFieldClass, nativeLabelClass, nativeSelectClass, nativeTextareaClass } from "@/lib/config/fields";
import type { SupportCaseListItem } from "@/lib/services/cases";
import { CASE_PRIORITIES, CASE_STATUSES } from "@/models";

type CaseFormProps = {
  supportCase?: SupportCaseListItem;
  minimal?: boolean;
};

const statusLabels = {
  OPEN: "Open",
  SOLVED: "Solved",
  PENDING: "Pending",
  FOLLOW_UP: "Follow-up",
  ARCHIVED: "Archived",
};

const priorityLabels = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export function CaseForm({ supportCase, minimal = false }: CaseFormProps) {
  const action = supportCase ? updateCaseAction.bind(null, supportCase.id) : createCaseAction;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <form action={action} className="space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            <StudentFields
              initialName={supportCase?.studentName}
              initialEmail={supportCase?.studentEmail ?? undefined}
              initialLmsUserId={supportCase?.lmsUserId}
              hideWhenFound={minimal}
            />

            {!minimal && (
              <label className="flex flex-col gap-2 text-sm font-medium">
                Status <span className="text-danger">*</span>
                <select
                  name="status"
                  defaultValue={supportCase?.status ?? "OPEN"}
                  required
                  className={nativeSelectClass}
                >
                  {CASE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <TextField name="title" label="Case Title" defaultValue={supportCase?.title} required minLength={5} maxLength={200} />
          <TextAreaField name="question" label="Problem Description" defaultValue={supportCase?.question} required rows={6} maxLength={20_000} />

          {/* Solution section — only on create (minimal) */}
          {!supportCase && minimal && (
            <details className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <summary className="cursor-pointer text-sm font-semibold">Answer (Optional)</summary>
              <div className="mt-4 space-y-4">
                <TextAreaField name="solutionBody" label="Answer" rows={4} maxLength={20_000} description="Add an answer if you have one. It will be saved as the first reply." />
                <TextAreaField name="solutionFileLinks" label="File Links (PDF/Images)" description="One per line: title|https://url|type|note" rows={2} />
                <TextAreaField name="solutionVideoLinks" label="Video links" description="One per line: title|https://url|timestamp|summary" rows={2} />
              </div>
            </details>
          )}

          {/* Solved checkbox — only on create (minimal) */}
          {!supportCase && minimal && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="solveCase" defaultChecked className="accent-cyan-500" />
                Mark as solved when an answer is provided
              </label>
            </div>
          )}

          {(
            <details className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <summary className="cursor-pointer text-sm font-semibold">Additional Details</summary>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <TextField name="courseSlug" label="Course Slug" defaultValue={supportCase?.courseSlug ?? undefined} />
                <TextField name="batchNo" label="Batch No" type="number" defaultValue={supportCase?.batchNo?.toString()} />
                <TextField name="moduleSlug" label="Module Slug" />
                <TextField name="contentSlug" label="Content/Lesson Slug" />
                <TextField name="tags" label="Tags" defaultValue={supportCase?.tags.join(", ")} description="Separate with commas: react, image, api" />
                <label className="flex flex-col gap-2 text-sm font-medium">
                  Priority
                  <select
                    name="priority"
                    defaultValue={supportCase?.priority ?? "NORMAL"}
                    className={nativeSelectClass}
                  >
                    {CASE_PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {priorityLabels[priority]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </details>
          )}

          <div className="flex justify-end">
            <button type="submit" className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600">
              {supportCase ? "Update Case" : "Create Case"}
            </button>
          </div>
        </form>
    </section>
  );
}

function TextField({ label, description, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string }) {
  return (
    <label className={nativeLabelClass}>
      {label} {props.required && <span className="text-danger">*</span>}
      <input {...props} className={nativeFieldClass} />
      {description && <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{description}</span>}
    </label>
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
