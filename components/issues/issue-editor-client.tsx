"use client";

import { EditorContent, Extension, useEditor } from "@tiptap/react";
import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";

import { ImageIcon } from "@/components/icons";
import { CodeBlockIcon } from "@/components/issues/issue-editor-icons";
import { attachFilesNear, type AttachOutcome } from "@/components/shared/attachment-field";
import { IssueEditorToolbar } from "@/components/issues/issue-editor-toolbar";
import { getIssueMarkdown, issueEditorExtensions } from "@/lib/issue-editor-markdown";
import { IssueSmartPaste, revertCodePaste, type CodePaste } from "@/lib/issue-editor-smart-paste";
import { IssueFileIntake } from "@/lib/issue-editor-file-intake";
import { IssuePlaceholder } from "@/lib/issue-editor-placeholder";
import { ISSUE_TEMPLATE_SECTIONS } from "@/lib/issue-template";

export type IssueEditorApi = {
  /** Put the caret in the editor (end of the text). */
  focus: () => void;
  /**
   * Add the "Use template" headings: they replace an empty editor, or go after
   * the existing text (nothing is removed). The caret lands under the first.
   */
  insertTemplate: () => void;
};

export type IssueEditorClientProps = {
  id: string;
  labelId: string;
  describedById?: string;
  /** Markdown the editor starts from. Read once, on mount. */
  initialValue: string;
  placeholder?: string;
  invalid: boolean;
  required: boolean;
  onChange: (markdown: string) => void;
  onReady?: () => void;
  apiRef?: RefObject<IssueEditorApi | null>;
};

type AttachNotice = { message: string; container: HTMLElement | null };

/** Status line for screenshots pasted or dropped on the editor. */
export function describeAttach(
  outcome: (AttachOutcome & { container: HTMLElement | null }) | null,
): AttachNotice {
  if (!outcome) return { message: "Add screenshots in the Screenshots section.", container: null };
  const { added, note, container } = outcome;
  const addedText = added > 0 ? `${added} screenshot${added === 1 ? "" : "s"} added to Screenshots below.` : "";
  return { message: [addedText, note].filter(Boolean).join(" ") || "No screenshots were added.", container };
}

/** Bring the attachment field into view and put keyboard focus on it. */
function showAttachments(container: HTMLElement | null) {
  if (!container) return;
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  container.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
  container.querySelector<HTMLElement>('[role="button"]')?.focus({ preventScroll: true });
}

export const issueEditorContentClass =
  "issue-editor-content min-h-56 px-4 py-3 text-base leading-7 text-slate-800 outline-none dark:text-slate-100";

/**
 * The Tiptap part of IssueEditor, loaded only through `next/dynamic` so the
 * editor bundle stays off every other page. It owns no form state: every
 * change is reported as the Markdown that RichText renders.
 */
export default function IssueEditorClient({
  id,
  labelId,
  describedById,
  initialValue,
  placeholder,
  invalid,
  required,
  onChange,
  onReady,
  apiRef,
}: IssueEditorClientProps) {
  const onChangeRef = useRef(onChange);
  const onReadyRef = useRef(onReady);
  useEffect(() => {
    onChangeRef.current = onChange;
    onReadyRef.current = onReady;
  });

  const [linkOpen, setLinkOpen] = useState(false);
  // Bumped when Tiptap attaches its view. The toolbar reads command
  // availability on its first render, before the view exists (every command
  // reports "unavailable" then) and only re-reads on a transaction, so without
  // this every button but Link looked disabled until the first click or key.
  const [viewMounts, setViewMounts] = useState(0);
  // The last smart paste while it can still be undone; the extension clears it
  // on the next edit.
  const [codePaste, setCodePaste] = useState<CodePaste | null>(null);
  // Result of the last pasted/dropped screenshots, until the next edit.
  const [attachNotice, setAttachNotice] = useState<AttachNotice | null>(null);

  // Built once: the editor must not be recreated when the parent re-renders.
  const [extensions] = useState(() => [
    ...issueEditorExtensions(),
    IssuePlaceholder.configure({ placeholder: placeholder ?? "" }),
    // State setters are stable, so these closures never go stale.
    IssueSmartPaste.configure({ onCodePasteChange: setCodePaste }),
    IssueFileIntake.configure({
      onFiles: (files, source) => setAttachNotice(describeAttach(attachFilesNear(source, files))),
    }),
    Extension.create({
      name: "issueLinkShortcut",
      addKeyboardShortcuts: () => ({
        "Mod-k": () => {
          setLinkOpen(true);
          return true;
        },
      }),
    }),
  ]);

  const attributes = (isInvalid: boolean): Record<string, string> => ({
    id,
    role: "textbox",
    "aria-multiline": "true",
    "aria-labelledby": labelId,
    ...(describedById ? { "aria-describedby": describedById } : {}),
    ...(placeholder ? { "aria-placeholder": placeholder } : {}),
    "aria-required": String(required),
    "aria-invalid": String(isInvalid),
    spellcheck: "true",
    class: issueEditorContentClass,
  });

  const editor = useEditor({
    extensions,
    content: initialValue,
    contentType: "markdown",
    // This module never renders on the server (dynamic, ssr: false).
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    editorProps: { attributes: attributes(invalid) },
    onMount: () => setViewMounts((count) => count + 1),
    onUpdate: ({ editor: current }) => {
      setAttachNotice(null);
      onChangeRef.current(getIssueMarkdown(current));
    },
  });

  const undoCodePaste = () => {
    if (editor && codePaste) revertCodePaste(editor, codePaste);
    setCodePaste(null);
  };

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.setOptions({ editorProps: { attributes: attributes(invalid) } });
    // `attributes` only reads props that are already in this list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, invalid, describedById, required, placeholder]);

  useEffect(() => {
    if (editor) onReadyRef.current?.();
  }, [editor]);

  useImperativeHandle(
    apiRef,
    () => ({
      focus: () => {
        if (editor && !editor.isDestroyed) editor.commands.focus("end");
      },
      insertTemplate: () => {
        if (!editor || editor.isDestroyed) return;
        const { doc } = editor.state;
        const last = doc.lastChild;
        // Reuse an empty last paragraph (or the empty doc) instead of leaving
        // a blank line above the template.
        const from = editor.isEmpty
          ? 0
          : last?.type.name === "paragraph" && last.content.size === 0
            ? doc.content.size - last.nodeSize
            : doc.content.size;
        const nodes = ISSUE_TEMPLATE_SECTIONS.flatMap(({ heading }) => [
          { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: heading }] },
          { type: "paragraph" },
        ]);
        // Inside the paragraph under the first heading: heading = text + 2.
        const caret = from + ISSUE_TEMPLATE_SECTIONS[0].heading.length + 2 + 1;
        editor
          .chain()
          .insertContentAt({ from, to: doc.content.size }, nodes)
          .setTextSelection(caret)
          .scrollIntoView()
          .focus()
          .run();
      },
    }),
    [editor],
  );

  return (
    <>
      {editor ? (
        <IssueEditorToolbar
          key={viewMounts}
          editor={editor}
          editorId={id}
          linkOpen={linkOpen}
          onLinkOpenChange={setLinkOpen}
        />
      ) : null}
      <EditorContent editor={editor} data-issue-editor-ready="" />
      <p aria-live="polite" className="sr-only">
        {codePaste ? "Pasted text was formatted as a code block." : ""}
      </p>
      {attachNotice ? (
        <div
          role="status"
          data-issue-editor-attach-notice=""
          className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-slate-200 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
        >
          <ImageIcon size={14} className="shrink-0 text-cyan-600 dark:text-cyan-300" />
          <span className="min-w-0 flex-1">{attachNotice.message}</span>
          {attachNotice.container ? (
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => showAttachments(attachNotice.container)}
              className="inline-flex min-h-11 items-center rounded-md px-3 font-semibold text-cyan-700 hover:bg-cyan-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:text-cyan-300 dark:hover:bg-cyan-500/10"
            >
              Show
            </button>
          ) : null}
        </div>
      ) : null}
      {codePaste ? (
        <div
          data-issue-editor-paste-chip=""
          className="flex items-center gap-2 border-t border-slate-200 px-3 py-1 text-xs text-slate-600 dark:border-slate-700 dark:text-slate-300"
        >
          <CodeBlockIcon size={14} className="shrink-0 text-cyan-600 dark:text-cyan-300" />
          <span>Formatted as code</span>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={undoCodePaste}
            aria-label="Undo code formatting and keep the pasted text as plain text"
            className="inline-flex min-h-11 items-center rounded-md px-3 font-semibold text-cyan-700 hover:bg-cyan-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:text-cyan-300 dark:hover:bg-cyan-500/10"
          >
            Undo
          </button>
        </div>
      ) : null}
    </>
  );
}
