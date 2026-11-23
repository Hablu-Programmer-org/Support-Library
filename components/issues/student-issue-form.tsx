"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { createStudentIssueAction } from "@/actions/issues";
import {
  BookIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  FileTextIcon,
  HelpCircleIcon,
  SettingsIcon,
} from "@/components/icons";
import { IssueEditor, type IssueEditorApi } from "@/components/issues/issue-editor";
import { IssueReadinessPanel, type ReadinessItem } from "@/components/issues/issue-readiness-panel";
import { AttachmentField } from "@/components/shared/attachment-field";
import { IssueDetailsHint } from "@/components/shared/issue-details-hint";
import { ProblemTitleHint } from "@/components/shared/problem-title-hint";
import {
  nativeFieldClass,
  nativeSelectClass,
} from "@/lib/config/fields";
import {
  ISSUE_DETAILS_CREATE_MIN,
  ISSUE_DETAILS_MAX,
  ISSUE_TITLE_CREATE_MAX,
  ISSUE_TITLE_WARN_AT,
} from "@/lib/constants";
import {
  isIssueDetailsTooLong,
  issueDetailsMinimumProblem,
  TEMPLATE_ONLY_MESSAGE,
} from "@/lib/issue-content-rules";
import {
  clearIssueDraft,
  isEmptyIssueDraft,
  readIssueDraft,
  writeIssueDraft,
  type IssueDraftFields,
} from "@/lib/issue-draft";
import { hasTemplateHeadings, withoutEmptyTemplateSections } from "@/lib/issue-template";

const card =
  "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900/70";

function SectionTitle({ id, icon, children }: { id: string; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2.5">
      <span aria-hidden="true" className="shrink-0 text-cyan-600 dark:text-cyan-300">
        {icon}
      </span>
      <h2 id={id} className="text-base font-semibold text-slate-950 dark:text-white">
        {children}
      </h2>
    </div>
  );
}

function FieldLabel({ children, required = false }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
      {children}
      {required ? (
        <span className="text-danger" aria-hidden="true">
          {" "}*
        </span>
      ) : null}
    </span>
  );
}

/**
 * Client copy of the server's details rules; the server still decides.
 * `value` is the editor's Markdown, template outline included, so a request
 * that is only the outline gets its own message rather than "empty".
 */
export function issueDetailsProblem(value: string): string | null {
  const minimum = issueDetailsMinimumProblem(value);
  if (minimum === "template-only") return TEMPLATE_ONLY_MESSAGE;
  if (!value.trim()) return "Describe your issue so the support team can help.";
  if (minimum === "too-short") {
    return `Add at least ${ISSUE_DETAILS_CREATE_MIN} characters so the support team can understand the issue.`;
  }
  if (isIssueDetailsTooLong(withoutEmptyTemplateSections(value))) {
    return `Keep the details to ${ISSUE_DETAILS_MAX.toLocaleString("en-US")} characters or fewer.`;
  }
  return null;
}

/** Mirrors the create title rule: 5–80 characters on one line. */
function isReadyTitle(title: string) {
  const trimmed = title.trim();
  return trimmed.length >= 5 && trimmed.length <= ISSUE_TITLE_CREATE_MAX && !/[\r\n]/.test(trimmed);
}

type StudentIssueFormProps = {
  csrfToken: string;
  /** The student's LMS enrolments; the batch is derived from the chosen course. */
  courses: Array<{ slug: string; name: string; batchNo: number }>;
  /** localStorage key for the unsent draft (per account); no autosave without it. */
  draftKey?: string;
};

const draftTime = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });

export function StudentIssueForm({ csrfToken, courses, draftKey }: StudentIssueFormProps) {
  const [state, formAction, pending] = useActionState(
    createStudentIssueAction,
    {
      fieldErrors: {},
    },
  );
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [courseSlug, setCourseSlug] = useState("");
  const [moduleSlug, setModuleSlug] = useState("");
  const [contentSlug, setContentSlug] = useState("");
  const [tags, setTags] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [screenshotCount, setScreenshotCount] = useState(0);
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [restoredOptional, setRestoredOptional] = useState(false);
  // No autosave until the saved draft has been looked at: the empty first
  // render would otherwise overwrite it.
  const draftCheckedRef = useRef(false);
  const operationIdRef = useRef<HTMLInputElement>(null);
  const editorApi = useRef<IssueEditorApi | null>(null);
  // What the server receives: template sections the student left empty are
  // dropped. `question` keeps them so the editor (and a draft) is unchanged.
  const submittedQuestion = withoutEmptyTemplateSections(question);
  const selectedCourse = courses.find((course) => course.slug === courseSlug) ?? null;

  const draftFields: IssueDraftFields = { title, question, courseSlug, moduleSlug, contentSlug, tags };

  // Restored once the editor exists (it receives the Markdown). Reading
  // storage during render would differ between server and client.
  const handleEditorReady = () => {
    setEditorReady(true);
    if (!draftKey || draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    const draft = readIssueDraft(draftKey);
    // Someone already typing keeps what they typed.
    if (!draft || !isEmptyIssueDraft(draftFields)) return;
    setTitle(draft.title);
    setCourseSlug(courses.some((course) => course.slug === draft.courseSlug) ? draft.courseSlug : "");
    setModuleSlug(draft.moduleSlug);
    setContentSlug(draft.contentSlug);
    setTags(draft.tags);
    editorApi.current?.setMarkdown(draft.question);
    setRestoredOptional(Boolean(`${draft.moduleSlug}${draft.contentSlug}${draft.tags}`.trim()));
    setRestoredAt(draft.savedAt);
  };

  const discardDraft = () => {
    if (draftKey) clearIssueDraft(draftKey);
    setTitle("");
    setCourseSlug("");
    setModuleSlug("");
    setContentSlug("");
    setTags("");
    setDetailsError(null);
    setRestoredOptional(false);
    setRestoredAt(null);
    editorApi.current?.setMarkdown("");
    editorApi.current?.focus();
  };

  // Autosave shortly after typing stops. Paused while a submit is in flight
  // (the draft was cleared for it); a rejected submit ends `pending` and the
  // still-filled form is saved again.
  useEffect(() => {
    if (!draftKey || !draftCheckedRef.current || pending) return;
    const timer = window.setTimeout(
      () => writeIssueDraft(draftKey, { title, question, courseSlug, moduleSlug, contentSlug, tags }),
      500,
    );
    return () => window.clearTimeout(timer);
  }, [draftKey, pending, title, question, courseSlug, moduleSlug, contentSlug, tags]);

  const ensureOperationId = () => {
    if (operationIdRef.current && !operationIdRef.current.value) {
      operationIdRef.current.value = crypto.randomUUID();
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    // The details live in a hidden input, which the browser never validates.
    const problem = issueDetailsProblem(question);
    if (problem) {
      event.preventDefault();
      setDetailsError(problem);
      editorApi.current?.focus();
      return;
    }
    // Success redirects away from this form, so the draft goes now.
    if (draftKey) clearIssueDraft(draftKey);
    ensureOperationId();
  };

  // A native rule (title, course) blocks the submit before `onSubmit` runs.
  // Report the details problem in the same attempt instead of a second round;
  // the browser keeps focus on its first invalid field.
  const onNativeInvalid = () => {
    const problem = issueDetailsProblem(question);
    if (problem) setDetailsError(problem);
  };

  const onQuestionChange = (value: string) => {
    setQuestion(value);
    if (detailsError && !issueDetailsProblem(value)) setDetailsError(null);
  };

  const questionError = detailsError ?? state.fieldErrors?.question?.[0];
  const readiness: ReadinessItem[] = [
    { id: "title", label: "A short title for the problem", done: isReadyTitle(title) },
    { id: "details", label: `What happened, in ${ISSUE_DETAILS_CREATE_MIN}+ characters`, done: !issueDetailsProblem(question) },
    ...(courses.length > 0 ? [{ id: "course", label: "Your course", done: Boolean(courseSlug) }] : []),
    { id: "screenshot", label: "A screenshot of the error", done: screenshotCount > 0, optional: true },
  ];
  const formError = state.fieldErrors?._form?.[0];
  const optionalDetailsHaveError = Boolean(
    state.fieldErrors?.moduleSlug?.[0] ||
      state.fieldErrors?.contentSlug?.[0] ||
      state.fieldErrors?.tags?.[0],
  );

  const errorText = (message?: string) =>
    message ? (
      <p className="text-sm text-danger-600 dark:text-danger-500" role="alert">
        {message}
      </p>
    ) : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-10">
      <div className="order-2 min-w-0 lg:order-1">
        <form
          action={formAction}
          className="space-y-6"
          onSubmit={onSubmit}
          onInvalidCapture={onNativeInvalid}
          aria-describedby={formError ? "student-issue-error" : undefined}
        >
          <input ref={operationIdRef} type="hidden" name="operationId" />
          <input type="hidden" name="csrfToken" value={csrfToken} />

          {formError && (
            <p
              id="student-issue-error"
              className="rounded-2xl border border-danger-300 bg-danger-50 px-5 py-3 text-sm text-danger-700 dark:border-danger-500/40 dark:bg-danger-500/10 dark:text-danger-600"
              role="alert"
            >
              {formError}
            </p>
          )}

          {restoredAt !== null ? (
            <div
              role="status"
              data-issue-draft-restored=""
              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-cyan-200 bg-cyan-50 py-1 pl-5 pr-2 text-sm text-slate-700 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-slate-200"
            >
              <span className="min-w-0 flex-1 py-2">
                Restored your unsent draft from {draftTime.format(restoredAt)}. Screenshots are not kept in drafts.
              </span>
              <button
                type="button"
                onClick={discardDraft}
                className="inline-flex min-h-11 items-center rounded-lg px-3 font-semibold text-cyan-700 hover:bg-cyan-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:text-cyan-300 dark:hover:bg-cyan-500/15"
              >
                Discard draft
              </button>
            </div>
          ) : null}

          <section aria-labelledby="issue-section-heading" className={card}>
            <SectionTitle id="issue-section-heading" icon={<HelpCircleIcon size={18} />}>
              Describe your issue
            </SectionTitle>

            <div className="mt-5 space-y-5">
              <label className="flex flex-col gap-1.5">
                <FieldLabel required>Issue title</FieldLabel>
                <input
                  className={nativeFieldClass}
                  name="title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  required
                  minLength={5}
                  maxLength={ISSUE_TITLE_CREATE_MAX}
                  aria-invalid={state.fieldErrors?.title?.[0] ? "true" : "false"}
                  placeholder="Assignment submission link not found"
                />
                {errorText(state.fieldErrors?.title?.[0]) ?? (
                  <ProblemTitleHint
                    length={title.length}
                    max={ISSUE_TITLE_CREATE_MAX}
                    warnAt={ISSUE_TITLE_WARN_AT}
                  />
                )}
              </label>

              <IssueEditor
                id="issue-question"
                name="question"
                label={<FieldLabel required>Issue details</FieldLabel>}
                value={question}
                submitValue={submittedQuestion}
                onChange={onQuestionChange}
                onReady={handleEditorReady}
                required
                invalid={Boolean(questionError)}
                apiRef={editorApi}
                placeholder="What were you trying to do, what happened, and what have you tried?"
                labelAction={
                  <button
                    type="button"
                    onClick={() => editorApi.current?.insertTemplate()}
                    disabled={!editorReady || hasTemplateHeadings(question)}
                    aria-describedby="issue-template-note"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none dark:border-slate-700 dark:text-slate-200 dark:hover:border-cyan-500 dark:hover:text-cyan-300"
                  >
                    <FileTextIcon size={16} />
                    Use template
                    <span id="issue-template-note" className="sr-only">
                      Adds three headings: what you were trying to do, what happened, and what you tried.
                    </span>
                  </button>
                }
                footer={
                  <div className="space-y-1">
                    {errorText(questionError)}
                    <IssueDetailsHint value={submittedQuestion} />
                  </div>
                }
              />

              <div className="flex flex-col gap-1.5">
                <AttachmentField
                  label="Screenshots"
                  labelClassName="text-sm font-medium text-slate-700 dark:text-slate-300"
                  description="PNG, JPEG, GIF or WebP, up to 5 images of 5 MB each. Paste or drop them on the details too. Private until the team publishes this issue."
                  onCountChange={setScreenshotCount}
                />
                {errorText(state.fieldErrors?.uploads?.[0])}
              </div>
            </div>
          </section>

          <section aria-labelledby="course-section-heading" className={card}>
            <SectionTitle id="course-section-heading" icon={<BookIcon size={18} />}>
              Course context
            </SectionTitle>

            {courses.length > 0 ? (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <FieldLabel required>Course</FieldLabel>
                  <select
                    className={nativeSelectClass}
                    name="courseSlug"
                    required
                    value={courseSlug}
                    onChange={(event) => setCourseSlug(event.target.value)}
                    aria-invalid={state.fieldErrors?.courseSlug?.[0] ? "true" : "false"}
                  >
                    <option value="">Select your course</option>
                    {courses.map((course) => (
                      <option key={course.slug} value={course.slug}>
                        {course.name}
                        {course.batchNo > 0 ? ` — batch ${course.batchNo}` : ""}
                      </option>
                    ))}
                  </select>
                  {errorText(state.fieldErrors?.courseSlug?.[0])}
                </label>

                <label className="flex flex-col gap-1.5">
                  <FieldLabel>Batch</FieldLabel>
                  {/* Display only: the server derives the batch from the LMS enrolment. */}
                  <input
                    className={`${nativeFieldClass} cursor-not-allowed opacity-70`}
                    value={selectedCourse?.batchNo ? String(selectedCourse.batchNo) : ""}
                    placeholder="Select a course first"
                    readOnly
                    tabIndex={-1}
                    aria-label="Batch (filled from your enrolment)"
                  />
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Filled automatically from your course enrolment.
                  </span>
                </label>
              </div>
            ) : (
              <p className="mt-4 rounded-lg border border-warning-300 bg-warning-50 p-3 text-sm text-warning-800 dark:border-warning-800 dark:bg-warning-50/40 dark:text-warning-700">
                We could not find a course on your LMS account. You can still submit
                this issue — the team will ask for the course if it matters.
              </p>
            )}
          </section>

          {/* Remounts open when one of its fields comes back with an error. */}
          <details
            key={optionalDetailsHaveError ? "optional-error" : restoredOptional ? "optional-restored" : "optional-clean"}
            open={optionalDetailsHaveError || restoredOptional || undefined}
            className="group rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 sm:px-6 [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">
                <SettingsIcon size={18} />
              </span>
              <span className="flex-1 text-sm font-semibold text-slate-950 dark:text-white">
                Module, lesson or tags
                <span className="ml-2 font-normal text-slate-500 dark:text-slate-400">Optional</span>
              </span>
              <ChevronDownIcon
                size={16}
                aria-hidden="true"
                className="shrink-0 text-slate-400 transition group-open:rotate-180 motion-reduce:transition-none"
              />
            </summary>

            <div className="space-y-4 px-5 pb-6 sm:px-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <FieldLabel>Module slug</FieldLabel>
                  <input
                    className={nativeFieldClass}
                    name="moduleSlug"
                    value={moduleSlug}
                    onChange={(event) => setModuleSlug(event.target.value)}
                    maxLength={120}
                    placeholder="e.g., assets"
                    aria-invalid={state.fieldErrors?.moduleSlug?.[0] ? "true" : "false"}
                  />
                  {errorText(state.fieldErrors?.moduleSlug?.[0])}
                </label>

                <label className="flex flex-col gap-1.5">
                  <FieldLabel>Lesson slug</FieldLabel>
                  <input
                    className={nativeFieldClass}
                    name="contentSlug"
                    value={contentSlug}
                    onChange={(event) => setContentSlug(event.target.value)}
                    maxLength={120}
                    placeholder="e.g., images-lecture"
                    aria-invalid={state.fieldErrors?.contentSlug?.[0] ? "true" : "false"}
                  />
                  {errorText(state.fieldErrors?.contentSlug?.[0])}
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <FieldLabel>Tags</FieldLabel>
                <input
                  className={nativeFieldClass}
                  name="tags"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="react, image, rendering"
                  aria-invalid={state.fieldErrors?.tags?.[0] ? "true" : "false"}
                />
                {errorText(state.fieldErrors?.tags?.[0]) ?? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Separate with commas, lowercase letters and numbers only.
                  </p>
                )}
              </label>
            </div>
          </details>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending || isIssueDetailsTooLong(submittedQuestion)}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none sm:w-auto sm:min-w-52"
            >
              <CheckCircleIcon size={18} />
              {pending ? "Creating..." : "Create issue"}
            </button>
          </div>
        </form>
      </div>
      <div className="order-1 min-w-0 lg:order-2">
        <IssueReadinessPanel items={readiness} />
      </div>
    </div>
  );
}
