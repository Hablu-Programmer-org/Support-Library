"use client";

import type { ReactNode, RefObject } from "react";

import { IssueEditor, type IssueEditorApi } from "@/components/issues/issue-editor";
import { cn } from "@/lib/cn";
import { REPLY_BODY_MAX } from "@/lib/constants";

/** The length the server checks (`z.string().trim().max(...)`). */
const replyBodyLength = (value: string) => value.trim().length;

/**
 * Client copy of the reply body rules. The editor submits through a hidden
 * input, which the browser never validates, so the form checks this on submit.
 */
export function replyBodyProblem(
  value: string,
  { required = true, emptyMessage = "Write the response before sending." } = {},
): string | null {
  const length = replyBodyLength(value);
  if (required && length === 0) return emptyMessage;
  if (length > REPLY_BODY_MAX) {
    return `Keep it to ${REPLY_BODY_MAX.toLocaleString("en-US")} characters or fewer.`;
  }
  return null;
}

/** The counter appears once the text gets near the cap. */
const COUNTER_FROM = REPLY_BODY_MAX - 2_000;

type ReplyBodyFieldProps = {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (markdown: string) => void;
  error?: string | null;
  required?: boolean;
  placeholder?: string;
  apiRef?: RefObject<IssueEditorApi | null>;
  /** Called once the editor has loaded (e.g. to focus it). */
  onReady?: () => void;
};

/**
 * Compact Markdown editor for a reply body (staff response, student
 * follow-up, the answer saved as a first reply, editing a reply).
 */
export function ReplyBodyField({
  id,
  name,
  label,
  value,
  onChange,
  error,
  required = false,
  placeholder,
  apiRef,
  onReady,
}: ReplyBodyFieldProps) {
  const length = replyBodyLength(value);
  const tooLong = length > REPLY_BODY_MAX;
  let footer: ReactNode = null;
  if (error) {
    footer = (
      <p role="alert" className="text-sm text-danger-600 dark:text-danger-500">
        {error}
      </p>
    );
  } else if (length >= COUNTER_FROM) {
    footer = (
      <p className={cn("text-xs tabular-nums", tooLong ? "font-semibold text-danger-600 dark:text-danger-500" : "text-slate-500 dark:text-slate-400")}>
        {tooLong
          ? `Shorten by ${(length - REPLY_BODY_MAX).toLocaleString("en-US")} characters.`
          : `${length.toLocaleString("en-US")}/${REPLY_BODY_MAX.toLocaleString("en-US")}`}
      </p>
    );
  }

  return (
    <IssueEditor
      id={id}
      name={name}
      compact
      label={
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
          {required ? (
            <span className="text-danger" aria-hidden="true">
              {" "}*
            </span>
          ) : null}
        </span>
      }
      value={value}
      onChange={onChange}
      required={required}
      invalid={Boolean(error) || tooLong}
      placeholder={placeholder}
      apiRef={apiRef}
      onReady={onReady}
      footer={footer}
    />
  );
}
