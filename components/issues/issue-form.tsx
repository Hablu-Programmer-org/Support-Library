"use client";

import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useActionState, useId } from "react";

import { createIssueAction, updateIssueAction } from "@/actions/issues";
import { StudentFields } from "@/components/issues/student-fields";
import { nativeFieldClass, nativeLabelClass, nativeSelectClass, nativeTextareaClass } from "@/lib/config/fields";
import { CASE_PRIORITIES, CASE_STATUSES } from "@/lib/constants";

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

type IssueFormProps = {
  supportIssue?: { id: string; title: string; question: string; status: string; priority: string; courseSlug?: string | null; batchNo?: number | null; moduleSlug?: string | null; contentSlug?: string | null; tags: string[]; studentName?: string; studentEmail?: string | null; lmsUserId?: string | null };
  minimal?: boolean;
};

function SubmitButton({ isCreate, pending }: { isCreate: boolean; pending: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (isCreate ? "Creating..." : "Updating...") : isCreate ? "Create Issue" : "Update Issue"}
    </button>
  );
}

function ErrorMessage({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="mt-1 text-sm text-danger-600 dark:text-danger-400" role="alert">{error}</p>;
}

export function IssueForm({ supportIssue, minimal = false }: IssueFormProps) {
  const action = supportIssue ? updateIssueAction.bind(null, supportIssue.id) : createIssueAction;
  const isCreate = !supportIssue;
  const [state, formAction, pending] = useActionState(action, { fieldErrors: {} });

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <form action={formAction} className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <StudentFields
            initialName={supportIssue?.studentName}
            initialEmail={supportIssue?.studentEmail ?? undefined}
            initialLmsUserId={supportIssue?.lmsUserId}
            hideWhenFound={minimal}
          />

          {!minimal && (
            <label className="flex flex-col gap-2 text-sm font-medium">
              Status <span className="text-danger">*</span>
              <select
                name="status"
                defaultValue={supportIssue?.status ?? "OPEN"}
                required
                className={nativeSelectClass}
              >
                {CASE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
              <ErrorMessage error={state.fieldErrors?.status?.[0]} />
            </label>
          )}
        </div>

        <TextField
          name="title"
          label="Issue Title"
          defaultValue={supportIssue?.title}
          required
          minLength={5}
          maxLength={200}
          error={state.fieldErrors?.title?.[0]}
        />
        <TextAreaField
          name="question"
          label="Problem Description"
          defaultValue={supportIssue?.question}
          required
          rows={6}
          maxLength={20_000}
          error={state.fieldErrors?.question?.[0]}
        />

        {/* Solution section — only on create (minimal) */}
        {!supportIssue && minimal && (
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
        {!supportIssue && minimal && (
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="solveIssue" defaultChecked className="accent-cyan-500" />
              Mark as solved when an answer is provided
            </label>
          </div>
        )}

        {(
          <details className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
            <summary className="cursor-pointer text-sm font-semibold">Additional Details</summary>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextField name="courseSlug" label="Course Slug" defaultValue={supportIssue?.courseSlug ?? undefined} error={state.fieldErrors?.courseSlug?.[0]} />
              <TextField name="batchNo" label="Batch No" type="number" defaultValue={supportIssue?.batchNo?.toString()} error={state.fieldErrors?.batchNo?.[0]} />
              <TextField name="moduleSlug" label="Module Slug" error={state.fieldErrors?.moduleSlug?.[0]} />
              <TextField name="contentSlug" label="Content/Lesson Slug" error={state.fieldErrors?.contentSlug?.[0]} />
              <TextField name="tags" label="Tags" defaultValue={supportIssue?.tags.join(", ")} description="Separate with commas: react, image, api" error={state.fieldErrors?.tags?.[0]} />
              <label className="flex flex-col gap-2 text-sm font-medium">
                Priority
                <select
                  name="priority"
                  defaultValue={supportIssue?.priority ?? "NORMAL"}
                  className={nativeSelectClass}
                >
                  {CASE_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {priorityLabels[priority]}
                    </option>
                  ))}
                </select>
                <ErrorMessage error={state.fieldErrors?.priority?.[0]} />
              </label>
            </div>
          </details>
        )}

        <div className="flex justify-end">
          <SubmitButton isCreate={isCreate} pending={pending} />
        </div>
      </form>
    </section>
  );
}

function TextField({ label, description, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; description?: string; error?: string }) {
  const id = useId();
  const inputId = `${props.name}-${id}`;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <label className={nativeLabelClass}>
      {label} {props.required && <span className="text-danger">*</span>}
      <input
        {...props}
        id={inputId}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={errorId}
        className={nativeFieldClass}
      />
      {description && <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{description}</span>}
      <ErrorMessage error={error} />
    </label>
  );
}

function TextAreaField({ label, description, error, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; description?: string; error?: string }) {
  const id = useId();
  const textareaId = `${props.name}-${id}`;
  const errorId = error ? `${textareaId}-error` : undefined;
  return (
    <label className={nativeLabelClass}>
      {label} {props.required && <span className="text-danger">*</span>}
      <textarea
        {...props}
        id={textareaId}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={errorId}
        className={nativeTextareaClass}
      />
      {description && <span className="text-xs font-normal text-slate-500 dark:text-slate-400">{description}</span>}
      <ErrorMessage error={error} />
    </label>
  );
}