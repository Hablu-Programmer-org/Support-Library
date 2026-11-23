"use client";

import dynamic from "next/dynamic";
import type { ReactNode, RefObject } from "react";

import type { IssueEditorApi } from "@/components/issues/issue-editor-client";
import { Skeleton } from "@/components/shared/skeleton";
import { cn } from "@/lib/cn";

export type { IssueEditorApi } from "@/components/issues/issue-editor-client";

/**
 * Buttons per toolbar group. Mirrors ISSUE_EDITOR_TOOL_GROUPS (a test keeps
 * them equal) without importing the toolbar, which would pull Tiptap into
 * this page's main chunk.
 */
export const ISSUE_EDITOR_SKELETON_GROUPS = [3, 4, 1, 2];

/**
 * Same box as the loaded editor — the toolbar row uses the real button and
 * divider sizes so it wraps the same way at 375px — so nothing below moves.
 */
export function IssueEditorSkeleton() {
  return (
    <div data-issue-editor-skeleton="">
      <div className="flex flex-wrap items-center gap-0.5 rounded-t-lg border-b border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-800/60">
        {ISSUE_EDITOR_SKELETON_GROUPS.map((count, groupIndex) => (
          <div
            key={groupIndex}
            className={cn("flex items-center gap-0.5", groupIndex === ISSUE_EDITOR_SKELETON_GROUPS.length - 1 && "ml-auto")}
          >
            {groupIndex > 0 ? <span aria-hidden="true" className="mx-1 h-6 w-px" /> : null}
            {Array.from({ length: count }, (_, index) => (
              <span key={index} className="inline-flex size-11 items-center justify-center">
                <Skeleton className="size-5 rounded" />
              </span>
            ))}
          </div>
        ))}
      </div>
      <div className="min-h-56 space-y-3 px-4 py-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/5" />
      </div>
    </div>
  );
}

const IssueEditorClient = dynamic(() => import("@/components/issues/issue-editor-client"), {
  ssr: false,
  loading: () => <IssueEditorSkeleton />,
});

type IssueEditorProps = {
  /** id of the editable element; the label points at it. */
  id: string;
  /** Form field name of the hidden Markdown input. */
  name: string;
  label: ReactNode;
  /** Current Markdown. The editor starts from it and reports every change. */
  value: string;
  /** What the hidden input submits, when it differs from `value` (cleaned up). */
  submitValue?: string;
  onChange: (markdown: string) => void;
  /** Called once the editor chunk has loaded and `apiRef` works. */
  onReady?: () => void;
  /** Control shown at the end of the label row (e.g. "Use template"). */
  labelAction?: ReactNode;
  placeholder?: string;
  invalid?: boolean;
  required?: boolean;
  /** Counter / error row under the editor; announced as its description. */
  footer?: ReactNode;
  apiRef?: RefObject<IssueEditorApi | null>;
};

/**
 * WYSIWYG issue details field that submits plain Markdown.
 *
 * The form reads a hidden `<input name>` holding the editor's Markdown, so the
 * server action and its zod limits are unchanged. A hidden input has no native
 * `required`/`minLength`, so the owning form validates the value on submit and
 * calls `apiRef.current.focus()` on an error. Until the editor chunk loads the
 * hidden input holds whatever `value` the form has (empty on a fresh page), so
 * an early submit can only be rejected, never send different text.
 */
export function IssueEditor({
  id,
  name,
  label,
  value,
  submitValue,
  onChange,
  onReady,
  labelAction,
  placeholder,
  invalid = false,
  required = false,
  footer,
  apiRef,
}: IssueEditorProps) {
  const labelId = `${id}-label`;
  const footerId = footer ? `${id}-footer` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        {/* A contenteditable is not labelable, so the label focuses it by hand. */}
        <label id={labelId} onClick={() => apiRef?.current?.focus()} className="w-fit">
          {label}
        </label>
        {labelAction}
      </div>
      <input type="hidden" name={name} value={submitValue ?? value} />
      <div
        className={cn(
          // No overflow-hidden: toolbar tooltips must be able to leave the box.
          "rounded-lg border bg-white transition-colors dark:bg-slate-900",
          "focus-within:ring-2 focus-within:ring-cyan-500/20",
          invalid
            ? "border-danger-400 focus-within:border-danger-500 dark:border-danger-500/70"
            : "border-slate-200 hover:border-slate-300 focus-within:border-cyan-500 dark:border-slate-700 dark:hover:border-slate-600 dark:focus-within:border-cyan-500",
        )}
      >
        <IssueEditorClient
          id={id}
          labelId={labelId}
          describedById={footerId}
          initialValue={value}
          placeholder={placeholder}
          invalid={invalid}
          required={required}
          onChange={onChange}
          onReady={onReady}
          apiRef={apiRef}
        />
      </div>
      {footer ? <div id={footerId}>{footer}</div> : null}
    </div>
  );
}
