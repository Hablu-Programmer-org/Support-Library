"use client";

import { cn } from "@/lib/cn";
import { useActionState } from "react";

import { createIssueAction, updateIssueAction } from "@/actions/issues";
import {
  CheckCircleIcon,
  FileTextIcon,
  MessageSquareIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons";
import { Accordion } from "@/components/issues/accordion";
import { SectionCard } from "@/components/issues/section-card";
import { StudentFields } from "@/components/issues/student-fields";
import {
  nativeFieldClass,
  nativeSelectClass,
  nativeTextareaClass,
} from "@/lib/config/fields";
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
  supportIssue?: {
    id: string;
    title: string;
    question: string;
    status: string;
    priority: string;
    courseSlug?: string | null;
    batchNo?: number | null;
    moduleSlug?: string | null;
    contentSlug?: string | null;
    tags: string[];
    studentName?: string;
    studentEmail?: string | null;
    lmsUserId?: string | null;
  };
  minimal?: boolean;
};

function ErrorMessage({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p
      className="mt-1.5 text-sm text-danger-600 dark:text-danger-400 flex items-center gap-1"
      role="alert"
    >
      <CheckCircleIcon size={12} />
      {error}
    </p>
  );
}

function RequiredIndicator() {
  return (
    <span className="text-danger" aria-hidden="true">
      *
    </span>
  );
}

function FieldWrapper({
  label,
  required,
  description,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  description?: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </span>
        {required && <RequiredIndicator />}
      </div>
      {children}
      {description && !error && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      <ErrorMessage error={error} />
    </label>
  );
}

export function IssueForm({ supportIssue, minimal = false }: IssueFormProps) {
  const action = supportIssue
    ? updateIssueAction.bind(null, supportIssue.id)
    : createIssueAction;
  const [state, formAction] = useActionState(action, { fieldErrors: {} });

  return (
    <form action={formAction} className="space-y-5">
      {/* Section 1: Student Identity */}
      <SectionCard
        title="Student Identity"
        icon={<UserIcon size={20} />}
        description="Enter the student's email to auto-fill their name from the LMS database."
        required
      >
        <div className="grid gap-4 md:grid-cols-2">
          <StudentFields
            initialName={supportIssue?.studentName}
            initialEmail={supportIssue?.studentEmail ?? undefined}
            initialLmsUserId={supportIssue?.lmsUserId}
            hideWhenFound={minimal}
          />

          {!minimal && (
            <FieldWrapper
              label="Status"
              required
              error={state.fieldErrors?.status?.[0]}
            >
              <select
                name="status"
                defaultValue={supportIssue?.status ?? "OPEN"}
                required
                className={nativeSelectClass}
                aria-invalid={!!state.fieldErrors?.status?.[0]}
              >
                {CASE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </FieldWrapper>
          )}
        </div>
      </SectionCard>

      {/* Section 2: Issue Details */}
      <SectionCard
        title="Issue Details"
        icon={<FileTextIcon size={20} />}
        description="Describe the issue clearly. A good title helps with search and categorization."
        required
      >
        <div className="space-y-4">
          <FieldWrapper
            label="Issue Title"
            required
            error={state.fieldErrors?.title?.[0]}
          >
            <input
              name="title"
              defaultValue={supportIssue?.title}
              required
              minLength={5}
              maxLength={200}
              className={nativeFieldClass}
              aria-invalid={state.fieldErrors?.title?.[0] ? "true" : "false"}
              placeholder="e.g., React image not rendering in production build"
            />
          </FieldWrapper>

          <FieldWrapper
            label="Problem Description"
            required
            error={state.fieldErrors?.question?.[0]}
          >
            <textarea
              name="question"
              defaultValue={supportIssue?.question}
              required
              rows={5}
              maxLength={20_000}
              className={nativeTextareaClass}
              aria-invalid={state.fieldErrors?.question?.[0] ? "true" : "false"}
              placeholder="Describe the issue in detail. Include steps to reproduce, expected behavior, and actual behavior."
            />
          </FieldWrapper>
        </div>
      </SectionCard>

      {/* Section 3: Answer (Optional) - only on create/minimal */}
      {!supportIssue && minimal && (
        <Accordion
          title="Answer (Optional)"
          icon={<MessageSquareIcon size={20} />}
          defaultOpen
          contentClassName="space-y-4"
        >
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Provide an answer now to resolve this issue immediately. It will be
            saved as the first reply.
          </p>
          <FieldWrapper
            label="Answer"
            className="pt-2.5"
            error={state.fieldErrors?.solutionBody?.[0]}
          >
            <textarea
              name="solutionBody"
              rows={4}
              maxLength={20_000}
              className={nativeTextareaClass}
              aria-invalid={
                state.fieldErrors?.solutionBody?.[0] ? "true" : "false"
              }
              placeholder="Write your solution here..."
            />
          </FieldWrapper>

          <FieldWrapper
            className="pt-2.5"
            label="File Links (PDF/Images)"
            description="One per line: title|https://url|type|note"
            error={state.fieldErrors?.solutionFileLinks?.[0]}
          >
            <textarea
              name="solutionFileLinks"
              rows={2}
              className={nativeTextareaClass}
              aria-invalid={
                state.fieldErrors?.solutionFileLinks?.[0] ? "true" : "false"
              }
              placeholder="Screenshot|https://example.com/fix.png|image|Annotated screenshot"
            />
          </FieldWrapper>

          <FieldWrapper
            className="pt-2.5"
            label="Video Links"
            description="One per line: title|https://url|timestamp|summary"
            error={state.fieldErrors?.solutionVideoLinks?.[0]}
          >
            <textarea
              name="solutionVideoLinks"
              rows={2}
              className={nativeTextareaClass}
              aria-invalid={
                state.fieldErrors?.solutionVideoLinks?.[0] ? "true" : "false"
              }
              placeholder="Walkthrough|https://youtu.be/abc123|01:30|Fix demonstration"
            />
          </FieldWrapper>

          <div className="flex items-center gap-2 pt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="solveIssue"
                defaultChecked
                className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary-500 accent-primary"
              />
              <span className="text-slate-700 dark:text-slate-300">
                Mark as solved when an answer is provided
              </span>
            </label>
          </div>
        </Accordion>
      )}

      {/* Section 4: Additional Details (Metadata) */}
      <Accordion
        title="Additional Details"
        icon={<SettingsIcon size={20} />}
        defaultOpen={!minimal}
        contentClassName="space-y-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <FieldWrapper
            label="Course Slug"
            error={state.fieldErrors?.courseSlug?.[0]}
          >
            <input
              name="courseSlug"
              defaultValue={supportIssue?.courseSlug ?? undefined}
              className={nativeFieldClass}
              aria-invalid={
                state.fieldErrors?.courseSlug?.[0] ? "true" : "false"
              }
              placeholder="e.g., react-beginner"
            />
          </FieldWrapper>

          <FieldWrapper
            label="Batch No"
            error={state.fieldErrors?.batchNo?.[0]}
          >
            <input
              name="batchNo"
              type="number"
              defaultValue={supportIssue?.batchNo?.toString()}
              className={nativeFieldClass}
              aria-invalid={state.fieldErrors?.batchNo?.[0] ? "true" : "false"}
              placeholder="e.g., 1"
            />
          </FieldWrapper>

          <FieldWrapper
            label="Module Slug"
            error={state.fieldErrors?.moduleSlug?.[0]}
          >
            <input
              name="moduleSlug"
              defaultValue={supportIssue?.moduleSlug ?? undefined}
              className={nativeFieldClass}
              aria-invalid={
                state.fieldErrors?.moduleSlug?.[0] ? "true" : "false"
              }
              placeholder="e.g., assets"
            />
          </FieldWrapper>

          <FieldWrapper
            label="Content/Lesson Slug"
            error={state.fieldErrors?.contentSlug?.[0]}
          >
            <input
              name="contentSlug"
              defaultValue={supportIssue?.contentSlug ?? undefined}
              className={nativeFieldClass}
              aria-invalid={
                state.fieldErrors?.contentSlug?.[0] ? "true" : "false"
              }
              placeholder="e.g., images-lecture"
            />
          </FieldWrapper>

          <FieldWrapper
            label="Tags"
            description="Separate with commas: react, image, api"
            error={state.fieldErrors?.tags?.[0]}
          >
            <input
              name="tags"
              defaultValue={supportIssue?.tags.join(", ")}
              className={nativeFieldClass}
              aria-invalid={state.fieldErrors?.tags?.[0] ? "true" : "false"}
              placeholder="react, image, rendering"
            />
          </FieldWrapper>

          <FieldWrapper
            label="Priority"
            error={state.fieldErrors?.priority?.[0]}
          >
            <select
              name="priority"
              defaultValue={supportIssue?.priority ?? "NORMAL"}
              className={nativeSelectClass}
              aria-invalid={state.fieldErrors?.priority?.[0] ? "true" : "false"}
            >
              {CASE_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabels[priority]}
                </option>
              ))}
            </select>
          </FieldWrapper>
        </div>
      </Accordion>

      {/* Submit is handled by StickyActionBar on the page */}
    </form>
  );
}
