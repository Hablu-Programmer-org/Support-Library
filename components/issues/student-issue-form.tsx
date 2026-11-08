"use client";

import { useActionState, useRef, useState } from "react";

import { createStudentIssueAction } from "@/actions/issues";
import {
  CheckCircleIcon,
  HelpCircleIcon,
  SettingsIcon,
} from "@/components/icons";
import { Accordion } from "@/components/issues/accordion";
import { AttachmentField } from "@/components/shared/attachment-field";
import { IssueDetailsHint } from "@/components/shared/issue-details-hint";
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

  return (
    <form
      action={formAction}
      className="space-y-5"
      onSubmit={ensureOperationId}
      aria-describedby={formError ? "student-issue-error" : undefined}
    >
      <input ref={operationIdRef} type="hidden" name="operationId" />
      <input type="hidden" name="csrfToken" value={csrfToken} />

      {formError && (
        <p
          id="student-issue-error"
          className="border-l-2 border-danger-400 pl-3 py-2 text-sm text-danger-700 dark:text-danger-300"
          role="alert"
        >
          {formError}
        </p>
      )}

      <div className="space-y-6">
        <div className="flex items-center gap-2.5">
          <HelpCircleIcon
            aria-hidden="true"
            className="shrink-0 text-cyan-600 dark:text-cyan-300"
            size={19}
          />
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">
             Describe your issue
          </h2>
        </div>

        <div className="space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
               Issue title{" "}
              <span className="text-danger" aria-hidden="true">
                *
              </span>
            </span>
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
            {state.fieldErrors?.title?.[0] ? (
              <p
                className="text-sm text-danger-600 dark:text-danger-400"
                role="alert"
              >
                {state.fieldErrors.title[0]}
              </p>
            ) : (
              <ProblemTitleHint
                length={title.length}
                max={ISSUE_TITLE_CREATE_MAX}
                warnAt={ISSUE_TITLE_WARN_AT}
              />
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
               Issue details{" "}
              <span className="text-danger" aria-hidden="true">
                *
              </span>
            </span>
            <textarea
              className={nativeTextareaClass}
              name="question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              required
              rows={8}
              minLength={ISSUE_DETAILS_CREATE_MIN}
              maxLength={ISSUE_DETAILS_MAX}
              aria-invalid={state.fieldErrors?.question?.[0] ? "true" : "false"}
              placeholder={
                "What were you trying to do?\nWhat happened or what exact error did you see?\nWhat have you already tried?"
              }
            />
            {state.fieldErrors?.question?.[0] ? (
              <p
                className="text-sm text-danger-600 dark:text-danger-400"
                role="alert"
              >
                {state.fieldErrors.question[0]}
              </p>
            ) : (
              <IssueDetailsHint value={question} />
            )}
          </label>

          <div className="flex flex-col gap-1.5">
            <AttachmentField
              label="Attachments"
              description="Images only: PNG, JPEG, GIF or WebP, up to 3 images of 5 MB each. Private until the team publishes this request to the Student Library."
            />
            {state.fieldErrors?.uploads?.[0] && (
              <p
                className="text-sm text-danger-600 dark:text-danger-400"
                role="alert"
              >
                {state.fieldErrors.uploads[0]}
              </p>
            )}
          </div>

        </div>
      </div>

      <section className="space-y-4 border-t border-slate-200 pt-5 dark:border-slate-800">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">
            Course context
          </h3>
          <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Choose the course. Your batch is filled from your enrolment.
          </p>
        </div>

        {courses.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Course <span className="text-danger">*</span>
              </span>
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
              {state.fieldErrors?.courseSlug?.[0] && (
                <p className="text-sm text-danger-600 dark:text-danger-400" role="alert">
                  {state.fieldErrors.courseSlug[0]}
                </p>
              )}
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Batch
              </span>
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
          <p className="rounded-lg border border-warning-300 bg-warning-50 p-3 text-sm text-warning-800 dark:border-warning-800 dark:bg-warning-950/40 dark:text-warning-200">
            We could not find a course on your LMS account. You can still submit
            this request — the team will ask for the course if it matters.
          </p>
        )}
      </section>

      <Accordion
        key={optionalDetailsHaveError ? "optional-error" : "optional-clean"}
        title="Add module, lesson, tags or video links"
        defaultOpen={optionalDetailsHaveError}
        icon={<SettingsIcon size={20} />}
        contentClassName="space-y-4"
        className="border-t border-slate-200 dark:border-slate-800"
        titleClassName="rounded-lg px-2"
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">
          These optional details help the team find the exact lesson or walkthrough faster.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Module slug
            </span>
            <input
              className={nativeFieldClass}
              name="moduleSlug"
              value={moduleSlug}
              onChange={(event) => setModuleSlug(event.target.value)}
              maxLength={120}
              placeholder="e.g., assets"
              aria-invalid={
                state.fieldErrors?.moduleSlug?.[0] ? "true" : "false"
              }
            />
            {state.fieldErrors?.moduleSlug?.[0] && (
              <p
                className="text-sm text-danger-600 dark:text-danger-400"
                role="alert"
              >
                {state.fieldErrors.moduleSlug[0]}
              </p>
            )}
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Lesson slug
            </span>
            <input
              className={nativeFieldClass}
              name="contentSlug"
              value={contentSlug}
              onChange={(event) => setContentSlug(event.target.value)}
              maxLength={120}
              placeholder="e.g., images-lecture"
              aria-invalid={
                state.fieldErrors?.contentSlug?.[0] ? "true" : "false"
              }
            />
            {state.fieldErrors?.contentSlug?.[0] && (
              <p
                className="text-sm text-danger-600 dark:text-danger-400"
                role="alert"
              >
                {state.fieldErrors.contentSlug[0]}
              </p>
            )}
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Tags
          </span>
          <input
            className={nativeFieldClass}
            name="tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="react, image, rendering"
            aria-invalid={state.fieldErrors?.tags?.[0] ? "true" : "false"}
          />
          {state.fieldErrors?.tags?.[0] ? (
            <p
              className="text-sm text-danger-600 dark:text-danger-400"
              role="alert"
            >
              {state.fieldErrors.tags[0]}
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Separate with commas, lowercase letters and numbers only.
            </p>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Video links
          </span>
          <textarea
            className={nativeTextareaCompactClass}
            name="videoLinks"
            value={videoLinks}
            onChange={(event) => setVideoLinks(event.target.value)}
            rows={2}
            aria-invalid={state.fieldErrors?.videoLinks?.[0] ? "true" : "false"}
            placeholder="Walkthrough|https://youtu.be/videoId|01:30|Shows the bug"
          />
          {state.fieldErrors?.videoLinks?.[0] ? (
            <p className="text-sm text-danger-600 dark:text-danger-400" role="alert">
              {state.fieldErrors.videoLinks[0]}
            </p>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              One per line: <span className="font-medium">Title|https://link</span>
            </p>
          )}
        </label>
      </Accordion>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 motion-reduce:transition-none dark:focus:ring-offset-slate-950 sm:w-auto sm:min-w-52"
        >
          <CheckCircleIcon size={18} />
          {pending ? "Submitting..." : "Submit request"}
        </button>
      </div>

      <p className="text-center text-sm text-slate-500 dark:text-slate-400">
        After submitting, track replies and open Live support from the request page.
      </p>
    </form>
  );
}
