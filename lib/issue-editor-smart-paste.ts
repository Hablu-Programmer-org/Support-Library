import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Extension, type Editor, type JSONContent } from "@tiptap/react";

import { isStructuredHtml, looksLikeCode, pastedCode } from "@/lib/issue-editor-paste";

/** What the "Undo" chip needs to turn the code block back into text. */
export type CodePaste = {
  /** Position of the inserted code block. */
  from: number;
  /** The code exactly as it went into the block. */
  text: string;
  /** The document right after the paste; any later edit invalidates the chip. */
  doc: ProseMirrorNode;
};

type SmartPasteOptions = {
  /** The undoable paste, or null once any later edit makes undo unsafe. */
  onCodePasteChange: (paste: CodePaste | null) => void;
};
type SmartPasteStorage = { paste: CodePaste | null };

/**
 * Plain-text pastes that look like code (see `looksLikeCode`) become a code
 * block, then `onCodePasteChange` reports where so the UI can offer to undo
 * it, and reports null on the next edit. Files, structured HTML documents and
 * pastes inside code are left to the default paste handling.
 */
export const IssueSmartPaste = Extension.create<SmartPasteOptions, SmartPasteStorage>({
  name: "issueSmartPaste",
  addOptions: () => ({ onCodePasteChange: () => {} }),
  addStorage: () => ({ paste: null }),
  onUpdate() {
    // Runs for the paste transaction itself before `paste` is stored, then for
    // every later edit, which retires it.
    const { paste } = this.storage;
    if (paste && this.editor.state.doc !== paste.doc) {
      this.storage.paste = null;
      this.options.onCodePasteChange(null);
    }
  },
  addProseMirrorPlugins() {
    const { editor, options, storage } = this;
    return [
      new Plugin({
        key: new PluginKey("issueSmartPaste"),
        props: {
          handlePaste: (_view, event) => {
            const data = event.clipboardData;
            // File-only pastes (screenshots) belong to IssueFileIntake; a file
            // next to text (Word's PNG of the selection) does not stop this.
            if (!data) return false;
            const text = data.getData("text/plain");
            if (!text || !looksLikeCode(text) || isStructuredHtml(data.getData("text/html"))) return false;
            if (editor.isActive("codeBlock") || editor.isActive("code")) return false;

            const { code, language } = pastedCode(text);
            const start = editor.state.selection.from;
            const inserted = editor
              .chain()
              .insertContent({ type: "codeBlock", attrs: { language }, content: [{ type: "text", text: code }] })
              .run();
            if (!inserted) return false;

            const from = findCodeBlock(editor.state.doc, code, start - 2, editor.state.selection.to);
            if (from !== null) {
              storage.paste = { from, text: code, doc: editor.state.doc };
              options.onCodePasteChange(storage.paste);
            }
            return true;
          },
        },
      }),
    ];
  },
});

function findCodeBlock(doc: ProseMirrorNode, code: string, from: number, to: number): number | null {
  let found: number | null = null;
  doc.nodesBetween(Math.max(0, from), Math.min(doc.content.size, to), (node, pos) => {
    if (found !== null) return false;
    if (node.type.name === "codeBlock" && node.textContent === code) {
      found = pos;
      return false;
    }
    return true;
  });
  return found;
}

/**
 * Replace the pasted code block with one paragraph per line — what a normal
 * plain-text paste would have produced. Refuses (returns false) if anything
 * changed since the paste, so it can never rewrite the wrong content.
 */
export function revertCodePaste(editor: Editor, paste: CodePaste): boolean {
  if (editor.state.doc !== paste.doc) return false;
  const node = editor.state.doc.nodeAt(paste.from);
  if (!node || node.type.name !== "codeBlock") return false;
  // Leading indent is dropped: it does not survive as Markdown prose anyway
  // (see the paragraph rule in lib/issue-editor-markdown).
  const paragraphs: JSONContent[] = paste.text.split("\n").map((raw) => {
    const line = raw.trimStart();
    return { type: "paragraph", ...(line ? { content: [{ type: "text", text: line }] } : {}) };
  });
  return editor
    .chain()
    .focus()
    .insertContentAt({ from: paste.from, to: paste.from + node.nodeSize }, paragraphs)
    .run();
}
