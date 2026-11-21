"use client";

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { flushSync } from "react-dom";

import { RichText } from "@/lib/rich-text";

type Tab = "write" | "preview";

type MarkdownFieldProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange" | "id"> & {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Field label, wired to the textarea with htmlFor. */
  label: ReactNode;
  /** Shown under both tabs (character count, error). */
  footer?: ReactNode;
};

const tabClass = (active: boolean) =>
  `inline-flex min-h-11 items-center rounded-lg px-4 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 motion-reduce:transition-none ${
    active
      ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white"
      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
  }`;

/**
 * A Markdown textarea with a Write / Preview switch.
 *
 * The preview uses the same safe `RichText` renderer as the issue page, so what
 * the student sees here is what the case will show. The textarea stays in the
 * form the whole time (only hidden while previewing), so its name, `required`
 * and length limits keep working. If the browser rejects it while the preview is
 * open, the field switches back to Write first so the validation message can
 * actually be shown next to it.
 */
export function MarkdownField({
  id,
  value,
  onChange,
  label,
  footer,
  className,
  onInvalid,
  ...textareaProps
}: MarkdownFieldProps) {
  const generatedId = useId();
  const fieldId = id ?? `markdown-${generatedId}`;
  const writeTabId = `${fieldId}-write-tab`;
  const previewTabId = `${fieldId}-preview-tab`;
  const writePanelId = `${fieldId}-write`;
  const previewPanelId = `${fieldId}-preview`;
  const [tab, setTab] = useState<Tab>("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ write: null, preview: null });

  const select = (next: Tab, focusTab = false) => {
    setTab(next);
    if (focusTab) tabRefs.current[next]?.focus();
  };

  const onTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next: Tab =
      event.key === "Home" ? "write" : event.key === "End" ? "preview" : tab === "write" ? "preview" : "write";
    select(next, true);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <label htmlFor={fieldId} className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
        <div
          role="tablist"
          aria-label="Issue details editor"
          className="inline-flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
        >
          <button
            ref={(node) => {
              tabRefs.current.write = node;
            }}
            id={writeTabId}
            type="button"
            role="tab"
            aria-selected={tab === "write"}
            aria-controls={writePanelId}
            tabIndex={tab === "write" ? 0 : -1}
            onClick={() => select("write")}
            onKeyDown={onTabKeyDown}
            className={tabClass(tab === "write")}
          >
            Write
          </button>
          <button
            ref={(node) => {
              tabRefs.current.preview = node;
            }}
            id={previewTabId}
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            aria-controls={previewPanelId}
            tabIndex={tab === "preview" ? 0 : -1}
            onClick={() => select("preview")}
            onKeyDown={onTabKeyDown}
            className={tabClass(tab === "preview")}
          >
            Preview
          </button>
        </div>
      </div>

      {/* The panel wraps the textarea so the textarea keeps its textbox role. */}
      <div id={writePanelId} role="tabpanel" aria-labelledby={writeTabId} hidden={tab !== "write"}>
        <textarea
          {...textareaProps}
          ref={textareaRef}
          id={fieldId}
          className={className}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onInvalid={(event) => {
            onInvalid?.(event);
            if (tab === "write") return;
            // A hidden control cannot show its validation bubble: switch back,
            // then ask the browser to report it again now that it is visible.
            flushSync(() => setTab("write"));
            requestAnimationFrame(() => {
              textareaRef.current?.focus();
              textareaRef.current?.reportValidity();
            });
          }}
        />
      </div>

      {tab === "preview" ? (
        <div
          id={previewPanelId}
          role="tabpanel"
          aria-labelledby={previewTabId}
          tabIndex={0}
          className="min-h-56 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-700 dark:bg-slate-950/40"
        >
          {value.trim() ? (
            <RichText text={value} className="text-base leading-8 text-slate-800 dark:text-slate-100" />
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Markdown supported: <code className="font-mono">**bold**</code>,{" "}
          <code className="font-mono">`code`</code>, <code className="font-mono">```</code> code
          blocks, <code className="font-mono">- lists</code>, <code className="font-mono">## headings</code>.
        </p>
      )}

      {footer}
    </div>
  );
}
