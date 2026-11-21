"use client";

import { useActionState, useRef, useState, type ReactNode } from "react";

import { createStudentIssueAction } from "@/actions/issues";
import {
  BookIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  HelpCircleIcon,
  ImageIcon,
  SettingsIcon,
} from "@/components/icons";
import { AttachmentField } from "@/components/shared/attachment-field";
import { IssueDetailsHint } from "@/components/shared/issue-details-hint";
import { MarkdownField } from "@/components/shared/markdown-field";
import { ProblemTitleHint } from "@/components/shared/problem-title-hint";
import {
  nativeFieldClass,
  nativeSelectClass,
  nativeTextareaClass,
  nativeTextareaCompactClass,
} from "@/lib/config/fields";
import {
  ISSUE_DETAILS_CREATE_MIN,
  ISSUE_DETAILS_MAX,
  ISSUE_TITLE_CREATE_MAX,
  ISSUE_TITLE_WARN_AT,
} from "@/lib/constants";

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

type StudentIssueFormProps = {
  csrfToken: string;
  /** The student's LMS enrolments; the batch is derived from the chosen course. */
  courses: Array<{ slug: string; name: string; batchNo: number }>;
};

export function StudentIssueForm({ csrfToken, courses }: StudentIssueFormProps) {
  const [state, formAction, pending] = useActionState(
    createStudentIssueAction,
    {
      fieldErrors: {},
    },
  );
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");
  const [videoLinks, setVideoLinks] = useState("");
  const [courseSlug, setCourseSlug] = useState("");
  const [moduleSlug, setModuleSlug] = useState("");
  const [contentSlug, setContentSlug] = useState("");
  const [tags, setTags] = useState("");
  const operationIdRef = useRef<HTMLInputElement>(null);
  const selectedCourse = courses.find((course) => course.slug === courseSlug) ?? null;

  const ensureOperationId = () => {
    if (operationIdRef.current && !operationIdRef.current.value) {
      operationIdRef.current.value = crypto.randomUUID();
    }
  };

  const formError = state.fieldErrors?._form?.[0];
  const optionalDetailsHaveError = Boolean(
    state.fieldErrors?.videoLinks?.[0] ||
      state.fieldErrors?.moduleSlug?.[0] ||
      state.fieldErrors?.contentSlug?.[0] ||
      state.fieldErrors?.tags?.[0],
  );

  const errorText = (message?: string) =>
    message ? (
      <p className="text-sm text-danger-600 dark:text-danger-400" role="alert">
        {message}
      </p>
    ) : null;

  return (
    <form
      action={formAction}
      className="space-y-6"
      onSubmit={ensureOperationId}
      aria-describedby={formError ? "student-issue-error" : undefined}
    >
      <input ref={operationIdRef} type="hidden" name="operationId" />
      <input type="hidden" name="csrfToken" value={csrfToken} />

      {formError && (
        <p
          id="student-issue-error"
          className="rounded-2xl border border-danger-300 bg-danger-50 px-5 py-3 text-sm text-danger-700 dark:border-danger-500/40 dark:bg-danger-500/10 dark:text-danger-300"
          role="alert"
        >
          {formError}
        </p>
      )}

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

          <MarkdownField
            id="issue-question"
            label={<FieldLabel required>Issue details</FieldLabel>}
            className={nativeTextareaClass}
            name="question"
            value={question}
            onChange={setQuestion}
            required
            rows={10}
            minLength={ISSUE_DETAILS_CREATE_MIN}
            maxLength={ISSUE_DETAILS_MAX}
            aria-invalid={state.fieldErrors?.question?.[0] ? "true" : "false"}
            placeholder={
              "What were you trying to do?\nWhat happened or what exact error did you see?\nWhat have you already tried?"
            }
            footer={errorText(state.fieldErrors?.question?.[0]) ?? <IssueDetailsHint value={question} />}
          />
        </div>
      </section>

      <section aria-labelledby="attachments-section-heading" className={card}>
        <SectionTitle id="attachments-section-heading" icon={<ImageIcon size={18} />}>
          Screenshots
        </SectionTitle>
        <div className="mt-4 flex flex-col gap-1.5">
          <AttachmentField
            label="Attachments"
            description="Images only: PNG, JPEG, GIF or WebP, up to 5 images of 5 MB each. Private until the team publishes this issue to the Student Library."
          />
          {errorText(state.fieldErrors?.uploads?.[0])}
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
          <p className="mt-4 rounded-lg border border-warning-300 bg-warning-50 p-3 text-sm text-warning-800 dark:border-warning-800 dark:bg-warning-950/40 dark:text-warning-200">
            We could not find a course on your LMS account. You can still submit
            this issue — the team will ask for the course if it matters.
          </p>
        )}
      </section>

      {/* Remounts open when one of its fields comes back with an error. */}
      <details
        key={optionalDetailsHaveError ? "optional-error" : "optional-clean"}
        open={optionalDetailsHaveError || undefined}
        className="group rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl px-5 py-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 sm:px-6 [&::-webkit-details-marker]:hidden">
          <span aria-hidden="true" className="text-slate-400 dark:text-slate-500">
            <SettingsIcon size={18} />
          </span>
          <span className="flex-1 text-sm font-semibold text-slate-950 dark:text-white">
            Module, lesson, tags or video links
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

          <label className="flex flex-col gap-1.5">
            <FieldLabel>Video links</FieldLabel>
            <textarea
              className={nativeTextareaCompactClass}
              name="videoLinks"
              value={videoLinks}
              onChange={(event) => setVideoLinks(event.target.value)}
              rows={2}
              aria-invalid={state.fieldErrors?.videoLinks?.[0] ? "true" : "false"}
              placeholder="Walkthrough|https://youtu.be/videoId|01:30|Shows the bug"
            />
            {errorText(state.fieldErrors?.videoLinks?.[0]) ?? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                One per line: <span className="font-medium">Title|https://link</span>
              </p>
            )}
          </label>
        </div>
      </details>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500 px-6 text-sm font-semibold text-slate-950 shadow-sm transition hover:bg-cyan-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none sm:w-auto sm:min-w-52"
        >
          <CheckCircleIcon size={18} />
          {pending ? "Creating..." : "Create issue"}
        </button>
      </div>
    </form>
  );
}
