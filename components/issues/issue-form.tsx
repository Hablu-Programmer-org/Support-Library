"use client";

import { useActionState, useCallback, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

import { createIssueAction, updateIssueAction } from "@/actions/issues";
import { StudentFields } from "@/components/issues/student-fields";
import { Accordion } from "@/components/issues/accordion";
import { SectionHeading } from "@/components/shared/section-heading";
import { AttachmentField } from "@/components/shared/attachment-field";
import { IssueEditor, type IssueEditorApi } from "@/components/issues/issue-editor";
import { staffIssueDetailsProblem } from "@/lib/issue-content-rules";
import { ReplyBodyField, replyBodyProblem } from "@/components/issues/reply-body-field";
import { IssueDetailsHint } from "@/components/shared/issue-details-hint";
import { ProblemTitleHint } from "@/components/shared/problem-title-hint";
import { AttachmentList } from "@/components/shared/attachment-list";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  FileTextIcon,
  MessageSquareIcon,
  SettingsIcon,
  UserIcon,
  WarningTriangleIcon,
} from "@/components/icons";
import {
  eyebrowClass,
  focusRingClass,
  primaryButtonClass,
  secondaryButtonClass,
  surfaceClass,
} from "@/lib/ui";
import {
  nativeFieldClass,
  nativeSelectClass,
} from "@/lib/config/fields";
import {
  CASE_PRIORITIES,
  CASE_STATUSES,
  ISSUE_TITLE_CREATE_MAX,
  ISSUE_TITLE_MAX,
  ISSUE_TITLE_WARN_AT,
} from "@/lib/constants";

const statusLabels = {
  OPEN: "Open",
  SOLVED: "Solved",
  PENDING: "Pending",
  AWAITING_STUDENT: "Waiting on student",
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
    uploads?: {
      id: string;
      originalName: string;
      byteSize: number;
      mimeType?: string;
      width?: number | null;
      height?: number | null;
    }[];
    updatedAt?: string;
  };
  minimal?: boolean;
  csrfToken?: string;
  /** List URL to return to after an edit is saved (keeps filter + page). */
  returnTo?: string;
  /** Edit mode: where Back / Cancel go (the issue, keeping the list state). */
  backHref?: string;
  /** Edit mode: the issue is live in the Student Library (saving unpublishes it). */
  isPublished?: boolean;
};

const noopSubscribe = () => () => {};
const isApplePlatform = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);

type FormData = {
  studentName: string;
  studentEmail: string;
  lmsUserId: string;
  title: string;
  question: string;
  status: string;
  priority: string;
  courseSlug: string;
  batchNo: string;
  moduleSlug: string;
  contentSlug: string;
  tags: string;
  solutionBody: string;
  solveIssue: boolean;
};

function ErrorMessage({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <p
      className="mt-1.5 text-sm text-danger-600 dark:text-danger-500 flex items-center gap-1"
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
    status: supportIssue?.status ?? "OPEN",
    priority: supportIssue?.priority ?? "NORMAL",
    courseSlug: supportIssue?.courseSlug ?? "",
    batchNo: supportIssue?.batchNo?.toString() ?? "",
    moduleSlug: supportIssue?.moduleSlug ?? "",
    contentSlug: supportIssue?.contentSlug ?? "",
    tags: supportIssue?.tags.join(", ") ?? "",
    solutionBody: "",
    solveIssue: true,
  };
}

export function IssueForm({
  supportIssue,
  minimal = false,
  csrfToken = "",
  returnTo,
  backHref,
  isPublished = false,
}: IssueFormProps) {
  // Server render says "Ctrl"; the client corrects it without a hydration mismatch.
  const apple = useSyncExternalStore(noopSubscribe, isApplePlatform, () => false);
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
  const solutionEditorApi = useRef<IssueEditorApi | null>(null);
  const questionEditorApi = useRef<IssueEditorApi | null>(null);
  const [questionClientError, setQuestionClientError] = useState<string | null>(null);
  const [solutionBodyError, setSolutionBodyError] = useState<string | null>(null);

  // Sync formData with supportIssue when it changes (for edit mode)
  // Using key prop on form to reset instead of useEffect to avoid lint warning
  const formKey = supportIssue?.id ?? "new";

  // Creation enforces the one-line, 80-char title rule; editing keeps the wider
  // legacy limit so older rows stay editable (see lib/validation/issue.ts).
  const titleMax = supportIssue ? ISSUE_TITLE_MAX : ISSUE_TITLE_CREATE_MAX;
  const titleWarnAt = supportIssue
    ? Math.round(ISSUE_TITLE_MAX * 0.75)
    : ISSUE_TITLE_WARN_AT;

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

  const solutionProblem = (value: string) => replyBodyProblem(value, { required: false });

  const handleSolutionBodyChange = (value: string) => {
    updateField("solutionBody", value);
    if (solutionBodyError && !solutionProblem(value)) setSolutionBodyError(null);
  };

  const detailsMode = supportIssue ? "edit" : "create";
  const questionError = questionClientError ?? state.fieldErrors?.question?.[0];

  const handleQuestionChange = (value: string) => {
    updateField("question", value);
    if (questionClientError && !staffIssueDetailsProblem(value, detailsMode)) setQuestionClientError(null);
  };

  /** Hidden inputs are never validated by the browser: check both editors. */
  const reportEditorProblems = () => {
    const questionProblem = staffIssueDetailsProblem(formData.question, detailsMode);
    const answerProblem = solutionProblem(formData.solutionBody);
    setQuestionClientError(questionProblem);
    setSolutionBodyError(answerProblem);
    return { questionProblem, answerProblem };
  };

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    const { questionProblem, answerProblem } = reportEditorProblems();
    if (questionProblem || answerProblem) {
      event.preventDefault();
      (questionProblem ? questionEditorApi : solutionEditorApi).current?.focus();
      return;
    }
    ensureOperationId();
  };


  const hiddenInputs = (
    <>
      {!supportIssue && <input ref={operationIdRef} type="hidden" name="operationId" />}
      {supportIssue && <input type="hidden" name="expectedUpdatedAt" value={supportIssue.updatedAt ?? ""} />}
      <input type="hidden" name="csrfToken" value={csrfToken} id="csrfToken" />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
    </>
  );

  const formError = state.fieldErrors?._form?.[0] ? (
    <p
      className="border-l-2 border-danger-400 pl-3 py-2 text-sm text-danger-700 dark:text-danger-600"
      role="alert"
    >
      {state.fieldErrors._form[0]}
    </p>
  ) : null;

  const titleField = (
    <FieldWrapper
      label="Issue title"
      required
      error={state.fieldErrors?.title?.[0]}
    >
      <ControlledInput
        name="title"
        value={formData.title}
        onChange={handleChange("title")}
        required
        minLength={5}
        maxLength={titleMax}
        error={state.fieldErrors?.title?.[0]}
        placeholder="Assignment submission link not found"
      />
      {!state.fieldErrors?.title?.[0] && (
        <ProblemTitleHint
          length={formData.title.length}
          max={titleMax}
          warnAt={titleWarnAt}
        />
      )}
    </FieldWrapper>
  );

  const detailsEditor = (
    <IssueEditor
      id="issue-question"
      name="question"
      label={
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Issue details</span>
          <RequiredIndicator />
        </span>
      }
      value={formData.question}
      onChange={handleQuestionChange}
      required
      invalid={Boolean(questionError)}
      apiRef={questionEditorApi}
      placeholder={
        supportIssue
          ? "Describe the issue in detail."
          : "What were they trying to do, what happened, and what has already been tried?"
      }
      footer={
        questionError ? (
          <ErrorMessage error={questionError} />
        ) : (
          <IssueDetailsHint value={formData.question} requireCreateMinimum={!supportIssue} />
        )
      }
    />
  );

  const statusField = (
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
  );

  const priorityField = (
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
  );

  const studentFields = (
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
  );

  const courseField = (label: string) => (
    <FieldWrapper label={label} error={state.fieldErrors?.courseSlug?.[0]}>
      <ControlledInput
        name="courseSlug"
        value={formData.courseSlug}
        onChange={handleChange("courseSlug")}
        error={state.fieldErrors?.courseSlug?.[0]}
        placeholder="e.g., react-beginner"
      />
    </FieldWrapper>
  );

  const batchField = (label: string) => (
    <FieldWrapper label={label} error={state.fieldErrors?.batchNo?.[0]}>
      <ControlledInput
        name="batchNo"
        value={formData.batchNo}
        onChange={handleChange("batchNo")}
        type="number"
        error={state.fieldErrors?.batchNo?.[0]}
        placeholder="e.g., 1"
      />
    </FieldWrapper>
  );

  const moduleField = (label: string) => (
    <FieldWrapper label={label} error={state.fieldErrors?.moduleSlug?.[0]}>
      <ControlledInput
        name="moduleSlug"
        value={formData.moduleSlug}
        onChange={handleChange("moduleSlug")}
        error={state.fieldErrors?.moduleSlug?.[0]}
        placeholder="e.g., assets"
      />
    </FieldWrapper>
  );

  const lessonField = (label: string) => (
    <FieldWrapper label={label} error={state.fieldErrors?.contentSlug?.[0]}>
      <ControlledInput
        name="contentSlug"
        value={formData.contentSlug}
        onChange={handleChange("contentSlug")}
        error={state.fieldErrors?.contentSlug?.[0]}
        placeholder="e.g., images-lecture"
      />
    </FieldWrapper>
  );

  const tagsField = (
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
  );

  const formProps = {
    action: formAction,
    onKeyDown: handleKeyDown,
    onSubmit,
    // A native rule (title, student email) blocks the submit before
    // `onSubmit` runs; report the editors in the same attempt.
    onInvalidCapture: reportEditorProblems,
  };

  if (supportIssue) {
    const uploads = supportIssue.uploads ?? [];
    return (
      <form key={formKey} {...formProps} className="w-full pb-10">
        {hiddenInputs}

        {/* Action bar: sticks under the fixed 4rem topbar so Save is always in
            reach on a long form. One submit button only (e2e `formFor`). The
            negative margins match PageContainer's gutters so the bar spans it. */}
        <div className="sticky top-16 z-30 -mx-4 mb-6 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 dark:border-slate-800 dark:bg-slate-950/85">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div className="min-w-0 flex-1">
              <Link
                href={backHref ?? `/dashboard/issues/${supportIssue.id}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white",
                  focusRingClass,
                )}
              >
                <ArrowLeftIcon size={14} />
                Back to issue
              </Link>
              <h1 className="mt-0.5 text-xl font-bold tracking-tight text-slate-950 dark:text-white">
                Edit issue
              </h1>
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Link
                href={backHref ?? `/dashboard/issues/${supportIssue.id}`}
                className={cn(secondaryButtonClass, "min-h-11 flex-1 sm:min-h-10 sm:flex-none")}
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={pending}
                aria-keyshortcuts={apple ? "Meta+Enter" : "Control+Enter"}
                className={cn(primaryButtonClass, "min-h-11 flex-1 sm:min-h-10 sm:flex-none")}
              >
                {pending ? "Saving..." : "Save Issue"}
                <kbd
                  aria-hidden="true"
                  className="hidden rounded bg-white/20 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white md:inline-flex"
                >
                  {apple ? "⌘↵" : "Ctrl+↵"}
                </kbd>
              </button>
            </div>
          </div>
        </div>

        {/* DOM order is the phone order: Manage, the issue, then student and
            course context. On desktop the grid moves both side parts right,
            matching the issue detail page. */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:grid-rows-[auto_1fr] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-x-10">
          <section
            aria-labelledby="edit-manage-heading"
            className={cn(surfaceClass, "space-y-4 p-5 lg:col-start-2 lg:row-start-1")}
          >
            <h2 id="edit-manage-heading" className={eyebrowClass}>Manage</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
              {statusField}
              {priorityField}
            </div>
            {isPublished && (
              <p className="flex gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <WarningTriangleIcon size={14} className="mt-0.5 shrink-0" />
                Published in the Student Library. Saving moves it back to admin review.
              </p>
            )}
          </section>

          <main className="min-w-0 space-y-6 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            {formError}

            <section
              aria-labelledby="edit-issue-heading"
              className={cn(surfaceClass, "space-y-5 p-5 sm:p-6")}
            >
              <h2 id="edit-issue-heading" className={eyebrowClass}>Issue</h2>
              {titleField}
              {detailsEditor}
            </section>

            <section
              aria-labelledby="edit-media-heading"
              className={cn(surfaceClass, "space-y-5 p-5 sm:p-6")}
            >
              <h2 id="edit-media-heading" className={eyebrowClass}>Media</h2>

              {/* Same tiles and preview dialog as the issue detail page, plus
                  a Remove checkbox per image. */}
              <AttachmentList
                bare
                title="Saved images"
                uploads={uploads}
                renderAction={(upload) => (
                  <label className="inline-flex min-h-9 w-fit cursor-pointer items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      name="removeUploadIds"
                      value={upload.id}
                      aria-label={`Remove ${upload.originalName}`}
                      className="h-4 w-4 rounded border-slate-300 text-danger focus:ring-danger-500"
                    />
                    Remove
                  </label>
                )}
              />

              <div className="flex flex-col gap-1.5">
                <AttachmentField
                  label={uploads.length > 0 ? "Add images" : "Attachments"}
                  existingCount={uploads.length}
                  description="PNG, JPEG, GIF or WebP · up to 5 images, 5 MB each · staff-only until published"
                />
                <ErrorMessage error={state.fieldErrors?.uploads?.[0]} />
              </div>
            </section>
          </main>

          <div className="space-y-6 lg:col-start-2 lg:row-start-2 lg:self-start">
            <section
              aria-labelledby="edit-student-heading"
              className={cn(surfaceClass, "space-y-4 p-5")}
            >
              <h2 id="edit-student-heading" className={eyebrowClass}>Student</h2>
              <div className="grid gap-4">{studentFields}</div>
            </section>

            <section
              aria-labelledby="edit-context-heading"
              className={cn(surfaceClass, "space-y-4 p-5")}
            >
              <h2 id="edit-context-heading" className={eyebrowClass}>Course context</h2>
              <div className="grid grid-cols-2 gap-3">
                {courseField("Course slug")}
                {batchField("Batch")}
                {moduleField("Module slug")}
                {lessonField("Lesson slug")}
              </div>
              {tagsField}
            </section>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form key={formKey} {...formProps} className="space-y-6">
      {hiddenInputs}
      {formError}
      {/* Section 1: Issue Details — the issue and its answer are the priority. */}
      <div className="divide-y divide-slate-200 dark:divide-slate-800">
      <section className="py-8 first:pt-0">
        <SectionHeading
          title="Issue Details"
          icon={<FileTextIcon size={16} />}
          description="Keep the title to one short line that names the problem."
        />
        <div className="mt-4 space-y-4">
          {titleField}
          {detailsEditor}
          {!minimal && statusField}
          <div className="flex flex-col gap-1.5">
            <AttachmentField description="Images only: PNG, JPEG, GIF or WebP. Add up to 5 images, 5 MB each. Only staff can open them until the case is published." />
            <ErrorMessage error={state.fieldErrors?.uploads?.[0]} />
          </div>
        </div>
      </section>

      {/* Section 2: Answer (Optional) - only on create/minimal */}
      {minimal && (
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
            <div className="pt-2.5">
              <ReplyBodyField
                id="issue-solution-body"
                name="solutionBody"
                label="Answer"
                value={formData.solutionBody}
                onChange={handleSolutionBodyChange}
                error={solutionBodyError ?? state.fieldErrors?.solutionBody?.[0]}
                apiRef={solutionEditorApi}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <AttachmentField
                name="solutionUploads"
                label="Answer attachments"
                description="Images only: PNG, JPEG, GIF or WebP. Add up to 5 images, 5 MB each. Only staff can open them until the case is published."
              />
              <ErrorMessage error={state.fieldErrors?.solutionUploads?.[0]} />
            </div>
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

      {/* Section 3: Student Identity (optional) — a general issue or reusable
          solution may name no learner; when given, name and email are all-or-none. */}
      <Accordion
        title="Student Identity (optional)"
        icon={<UserIcon size={20} />}
        defaultOpen
        contentClassName="space-y-4"
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Add the student&apos;s name and email when the case belongs to a specific
          learner; the name auto-fills from the LMS by email. Leave both empty for a
          general issue or solution that does not identify anyone.
        </p>
        <div className="grid gap-4 md:grid-cols-2">{studentFields}</div>
      </Accordion>

      {/* Section 4: Additional Details (Metadata) */}
      <Accordion
        title="Additional Details"
        icon={<SettingsIcon size={20} />}
        defaultOpen={!minimal}
        contentClassName="space-y-4"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {courseField("Course Slug")}
          {batchField("Batch No")}
          {moduleField("Module Slug")}
          {lessonField("Content/Lesson Slug")}
          {tagsField}
          {priorityField}
        </div>
      </Accordion>

      </div>

      <div className="flex justify-center flex-col pt-8">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950 w-full"
        >
          <span>{pending ? "Creating..." : "Create Issue"}</span>
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
