"use client";

import { EditorContent, Extension, useEditor } from "@tiptap/react";
import { Placeholder } from "@tiptap/extensions";
import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";

import { CodeBlockIcon } from "@/components/issues/issue-editor-icons";
import { IssueEditorToolbar } from "@/components/issues/issue-editor-toolbar";
import { getIssueMarkdown, issueEditorExtensions } from "@/lib/issue-editor-markdown";
import { IssueSmartPaste, revertCodePaste, type CodePaste } from "@/lib/issue-editor-smart-paste";

export type IssueEditorApi = {
  /** Put the caret in the editor (end of the text). */
  focus: () => void;
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
  apiRef?: RefObject<IssueEditorApi | null>;
};

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
  apiRef,
}: IssueEditorClientProps) {
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const [linkOpen, setLinkOpen] = useState(false);
  // The last smart paste while it can still be undone; the extension clears it
  // on the next edit.
  const [codePaste, setCodePaste] = useState<CodePaste | null>(null);

  // Built once: the editor must not be recreated when the parent re-renders.
  const [extensions] = useState(() => [
    ...issueEditorExtensions(),
    Placeholder.configure({ placeholder: placeholder ?? "" }),
    // State setters are stable, so these closures never go stale.
    IssueSmartPaste.configure({ onCodePasteChange: setCodePaste }),
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
    onUpdate: ({ editor: current }) => onChangeRef.current(getIssueMarkdown(current)),
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

  useImperativeHandle(
    apiRef,
    () => ({
      focus: () => {
        if (editor && !editor.isDestroyed) editor.commands.focus("end");
      },
    }),
    [editor],
  );

  return (
    <>
      {editor ? (
        <IssueEditorToolbar
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
