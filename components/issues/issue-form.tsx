"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { cn } from "@/lib/cn";

import { createIssueAction, updateIssueAction } from "@/actions/issues";
import { StudentFields } from "@/components/issues/student-fields";
import { Accordion } from "@/components/issues/accordion";
import { SectionCard } from "@/components/issues/section-card";
import {
  CheckCircleIcon,
  FileTextIcon,
  MessageSquareIcon,
  SettingsIcon,
  UserIcon,
} from "@/components/icons";
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
    fileLinks?: { title: string; url: string; type?: string | null; note?: string | null }[];
    videoLinks?: {
      title: string;
      url: string;
      timestamp?: string | null;
      summary?: string | null;
    }[];
    updatedAt?: string;
  };
  minimal?: boolean;
  csrfToken?: string;
};

type FormData = {
  studentName: string;
  studentEmail: string;
  lmsUserId: string;
  title: string;
  question: string;
  fileLinks: string;
  videoLinks: string;
  status: string;
  priority: string;
  courseSlug: string;
  batchNo: string;
  moduleSlug: string;
  contentSlug: string;
  tags: string;
  solutionBody: string;
  solutionFileLinks: string;
  solutionVideoLinks: string;
  solveIssue: boolean;
};

/**
 * Renders stored links back into the `title|url|type|note` line format the
 * `fileLinks` textarea expects. Empty trailing segments are trimmed so a link
 * with only a title+url round-trips cleanly.
 */
function formatFileLinks(
  links?: { title: string; url: string; type?: string | null; note?: string | null }[],
) {
  return (links ?? [])
    .map((link) => {
      const parts = [link.title, link.url, link.type ?? "", link.note ?? ""];
      while (parts.length > 2 && !parts[parts.length - 1]) parts.pop();
      return parts.join("|");
    })
    .join("\n");
}

function formatVideoLinks(
  links?: {
    title: string;
    url: string;
    timestamp?: string | null;
    summary?: string | null;
  }[],
) {
  return (links ?? [])
    .map((link) => {
      const parts = [link.title, link.url, link.timestamp ?? "", link.summary ?? ""];
      while (parts.length > 2 && !parts[parts.length - 1]) parts.pop();
      return parts.join("|");
    })
    .join("\n");
}

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

function ControlledInput({
  name,
  value,
  onChange,
  error,
  className,
  ...props
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
} & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "onChange" | "value" | "name"
>) {
  return (
    <input
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(className || nativeFieldClass)}
      aria-invalid={error ? "true" : "false"}
      {...props}
    />
  );
}

function ControlledTextarea({
  name,
  value,
  onChange,
  error,
  className,
  ...props
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
} & Omit<
  React.TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange" | "value" | "name"
>) {
  return (
    <textarea
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(className || nativeTextareaClass)}
      aria-invalid={error ? "true" : "false"}
      {...props}
    />
  );
}

function ControlledSelect({
  name,
  value,
  onChange,
  error,
  children,
  className,
}: {
  name: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      name={name}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(className || nativeSelectClass)}
      aria-invalid={error ? "true" : "false"}
    >
      {children}
    </select>
  );
}

function initFormData(supportIssue?: IssueFormProps["supportIssue"]): FormData {
  return {
    studentName: supportIssue?.studentName ?? "",
    studentEmail: supportIssue?.studentEmail ?? "",
    lmsUserId: supportIssue?.lmsUserId ?? "",
    title: supportIssue?.title ?? "",
    question: supportIssue?.question ?? "",
    fileLinks: formatFileLinks(supportIssue?.fileLinks),
    videoLinks: formatVideoLinks(supportIssue?.videoLinks),
    status: supportIssue?.status ?? "OPEN",
    priority: supportIssue?.priority ?? "NORMAL",
    courseSlug: supportIssue?.courseSlug ?? "",
    batchNo: supportIssue?.batchNo?.toString() ?? "",
    moduleSlug: supportIssue?.moduleSlug ?? "",
    contentSlug: supportIssue?.contentSlug ?? "",
    tags: supportIssue?.tags.join(", ") ?? "",
    solutionBody: "",
    solutionFileLinks: "",
    solutionVideoLinks: "",
    solveIssue: true,
  };
}

export function IssueForm({ supportIssue, minimal = false, csrfToken = "" }: IssueFormProps) {
  const action = supportIssue
    ? updateIssueAction.bind(null, supportIssue.id)
    : createIssueAction;
  const [state, formAction, pending] = useActionState(action, {
    fieldErrors: {},
  });

  const [formData, setFormData] = useState<FormData>(() =>
    initFormData(supportIssue),
  );
  const operationIdRef = useRef<HTMLInputElement>(null);

  // Sync formData with supportIssue when it changes (for edit mode)
  // Using key prop on form to reset instead of useEffect to avoid lint warning
  const formKey = supportIssue?.id ?? "new";

  const updateField = useCallback((field: keyof FormData, value: string) => {
    setFormData((prev) =>
      prev[field] === value ? prev : { ...prev, [field]: value },
    );
  }, []);

  const handleChange = (field: keyof FormData) => (value: string) => {
    updateField(field, value);
  };

  const handleStudentNameChange = useCallback(
    (value: string) => updateField("studentName", value),
    [updateField],
  );
  const handleStudentEmailChange = useCallback(
    (value: string) => updateField("studentEmail", value),
    [updateField],
  );
  const handleLmsUserIdChange = useCallback(
    (value: string) => updateField("lmsUserId", value),
    [updateField],
  );

  const handleSolveIssueChange = (checked: boolean) => {
    setFormData((prev) => ({ ...prev, solveIssue: checked }));
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLFormElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (!pending) event.currentTarget.requestSubmit();
    }
  };

  const ensureOperationId = () => {
    if (operationIdRef.current && !operationIdRef.current.value) {
      operationIdRef.current.value = crypto.randomUUID();
    }
  };

  return (
    <form
      key={formKey}
      action={formAction}
      className="space-y-5"
      onKeyDown={handleKeyDown}
      onSubmit={ensureOperationId}
    >
      {!supportIssue && <input ref={operationIdRef} type="hidden" name="operationId" />}
      {supportIssue && <input type="hidden" name="expectedUpdatedAt" value={supportIssue.updatedAt ?? ""} />}
      <input type="hidden" name="csrfToken" value={csrfToken} id="csrfToken" />
      {state.fieldErrors?._form?.[0] && (
        <p
          className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 dark:border-danger-900 dark:bg-danger-950/40 dark:text-danger-300"
          role="alert"
        >
          {state.fieldErrors._form[0]}
        </p>
      )}
      {/* Section 1: Student Identity */}
      <SectionCard
        title="Student Identity"
        icon={<UserIcon size={20} />}
        description="Enter the student's email to auto-fill their name from the LMS database."
        required
      >
        <div className="grid gap-4 md:grid-cols-2">
          <StudentFields
            name={formData.studentName}
            email={formData.studentEmail}
            lmsUserId={formData.lmsUserId}
            nameError={state.fieldErrors?.studentName?.[0]}
            emailError={state.fieldErrors?.studentEmail?.[0]}
            onNameChange={handleStudentNameChange}
            onEmailChange={handleStudentEmailChange}
            onLmsUserIdChange={handleLmsUserIdChange}
            csrfToken={csrfToken}
          />

          {!minimal && (
            <FieldWrapper
              label="Status"
              required
              error={state.fieldErrors?.status?.[0]}
            >
              <ControlledSelect
                name="status"
                value={formData.status}
                onChange={handleChange("status")}
                error={state.fieldErrors?.status?.[0]}
              >
                {CASE_STATUSES.filter((status) => status !== "ARCHIVED").map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </ControlledSelect>
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
            <ControlledInput
              name="title"
              value={formData.title}
              onChange={handleChange("title")}
              required
              minLength={5}
              maxLength={200}
              error={state.fieldErrors?.title?.[0]}
              placeholder="e.g., React image not rendering in production build"
            />
          </FieldWrapper>

          <FieldWrapper
            label="Problem Description"
            required
            error={state.fieldErrors?.question?.[0]}
          >
            <ControlledTextarea
              name="question"
              value={formData.question}
              onChange={handleChange("question")}
              required
              rows={5}
              maxLength={20_000}
              error={state.fieldErrors?.question?.[0]}
              placeholder="Describe the issue in detail. Include steps to reproduce, expected behavior, and actual behavior."
            />
          </FieldWrapper>

          <FieldWrapper
            label="Image / File Links"
            description="One per line: title|https://url|type|note. HTTPS links only; files are not uploaded."
            error={state.fieldErrors?.fileLinks?.[0]}
          >
            <ControlledTextarea
              name="fileLinks"
              value={formData.fileLinks}
              onChange={handleChange("fileLinks")}
              rows={2}
              error={state.fieldErrors?.fileLinks?.[0]}
              placeholder="Screenshot|https://example.com/error.png|image|What the student sees"
            />
          </FieldWrapper>

          <FieldWrapper
            label="Video Links"
            description="One per line: title|https://url|timestamp|summary"
            error={state.fieldErrors?.videoLinks?.[0]}
          >
            <ControlledTextarea
              name="videoLinks"
              value={formData.videoLinks}
              onChange={handleChange("videoLinks")}
              rows={2}
              error={state.fieldErrors?.videoLinks?.[0]}
              placeholder="Walkthrough|https://youtu.be/abc123|01:30|Reproduces the bug"
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
          <div className="space-y-4">
            <FieldWrapper
              label="Answer"
              className="pt-2.5"
              error={state.fieldErrors?.solutionBody?.[0]}
            >
              <ControlledTextarea
                name="solutionBody"
                value={formData.solutionBody}
                onChange={handleChange("solutionBody")}
                rows={4}
                maxLength={20_000}
                error={state.fieldErrors?.solutionBody?.[0]}
                placeholder="Write your solution here..."
              />
            </FieldWrapper>

            <FieldWrapper
              label="File Links (PDF/Images)"
              description="One per line: title|https://url|type|note"
              error={state.fieldErrors?.solutionFileLinks?.[0]}
            >
              <ControlledTextarea
                name="solutionFileLinks"
                value={formData.solutionFileLinks}
                onChange={handleChange("solutionFileLinks")}
                rows={2}
                error={state.fieldErrors?.solutionFileLinks?.[0]}
                placeholder="Screenshot|https://example.com/fix.png|image|Annotated screenshot"
              />
            </FieldWrapper>

            <FieldWrapper
              label="Video Links"
              description="One per line: title|https://url|timestamp|summary"
              error={state.fieldErrors?.solutionVideoLinks?.[0]}
            >
              <ControlledTextarea
                name="solutionVideoLinks"
                value={formData.solutionVideoLinks}
                onChange={handleChange("solutionVideoLinks")}
                rows={2}
                error={state.fieldErrors?.solutionVideoLinks?.[0]}
                placeholder="Walkthrough|https://youtu.be/abc123|01:30|Fix demonstration"
              />
            </FieldWrapper>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                name="solveIssue"
                checked={formData.solveIssue}
                onChange={(e) => handleSolveIssueChange(e.target.checked)}
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
            <ControlledInput
              name="courseSlug"
              value={formData.courseSlug}
              onChange={handleChange("courseSlug")}
              error={state.fieldErrors?.courseSlug?.[0]}
              placeholder="e.g., react-beginner"
            />
          </FieldWrapper>

          <FieldWrapper
            label="Batch No"
            error={state.fieldErrors?.batchNo?.[0]}
          >
            <ControlledInput
              name="batchNo"
              value={formData.batchNo}
              onChange={handleChange("batchNo")}
              type="number"
              error={state.fieldErrors?.batchNo?.[0]}
              placeholder="e.g., 1"
            />
          </FieldWrapper>

          <FieldWrapper
            label="Module Slug"
            error={state.fieldErrors?.moduleSlug?.[0]}
          >
            <ControlledInput
              name="moduleSlug"
              value={formData.moduleSlug}
              onChange={handleChange("moduleSlug")}
              error={state.fieldErrors?.moduleSlug?.[0]}
              placeholder="e.g., assets"
            />
          </FieldWrapper>

          <FieldWrapper
            label="Content/Lesson Slug"
            error={state.fieldErrors?.contentSlug?.[0]}
          >
            <ControlledInput
              name="contentSlug"
              value={formData.contentSlug}
              onChange={handleChange("contentSlug")}
              error={state.fieldErrors?.contentSlug?.[0]}
              placeholder="e.g., images-lecture"
            />
          </FieldWrapper>

          <FieldWrapper
            label="Tags"
            description="Separate with commas: react, image, api"
            error={state.fieldErrors?.tags?.[0]}
          >
            <ControlledInput
              name="tags"
              value={formData.tags}
              onChange={handleChange("tags")}
              error={state.fieldErrors?.tags?.[0]}
              placeholder="react, image, rendering"
            />
          </FieldWrapper>

          <FieldWrapper
            label="Priority"
            error={state.fieldErrors?.priority?.[0]}
          >
            <ControlledSelect
              name="priority"
              value={formData.priority}
              onChange={handleChange("priority")}
              error={state.fieldErrors?.priority?.[0]}
            >
              {CASE_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priorityLabels[priority]}
                </option>
              ))}
            </ControlledSelect>
          </FieldWrapper>
        </div>
      </Accordion>

      <div className="flex justify-center flex-col pt-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950 w-full"
        >
          <span>
            {pending
              ? supportIssue
                ? "Saving..."
                : "Creating..."
              : supportIssue
                ? "Save Issue"
                : "Create Issue"}
          </span>
          <kbd
            aria-hidden="true"
            className="hidden items-center justify-center rounded bg-slate-200 px-1.5 py-0.5 text-xs font-mono text-slate-600 dark:bg-slate-700 dark:text-slate-300 md:inline-flex"
          >
            ⌘Enter
          </kbd>
        </button>

        <div className="w-full  flex items-center justify-center pt-2">
          <span className="text-xs text-slate-500/80 dark:text-slate-400/80">
            Press Cmd+Enter to submit
          </span>
        </div>
      </div>
    </form>
  );
}
