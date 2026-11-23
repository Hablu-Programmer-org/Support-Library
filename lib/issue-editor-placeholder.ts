import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { Extension } from "@tiptap/react";

import { templateHintFor } from "@/lib/issue-template";

type IssuePlaceholderOptions = { placeholder: string };

/**
 * Grey hints for empty paragraphs: the editor's prompt while it is empty, and
 * under each "Use template" heading that section's hint. Shown with CSS
 * (`p.is-empty::before { content: attr(data-placeholder) }`), so a hint is
 * never text in the document or the Markdown.
 *
 * Tiptap's Placeholder only hands its callback a node and a position, and
 * `editor.state` is still the previous document while decorations for the
 * next one are built, so it cannot look at the heading above a paragraph
 * reliably. This reads the state it is given.
 */
export const IssuePlaceholder = Extension.create<IssuePlaceholderOptions>({
  name: "issuePlaceholder",
  addOptions: () => ({ placeholder: "" }),
  addProseMirrorPlugins() {
    const prompt = this.options.placeholder;
    return [
      new Plugin({
        key: new PluginKey("issuePlaceholder"),
        props: {
          decorations: ({ doc }) => {
            const first = doc.firstChild;
            const docEmpty = doc.childCount === 1 && !!first?.isTextblock && first.content.size === 0;
            const decorations: Decoration[] = [];
            let previous: ProseMirrorNode | null = null;
            doc.forEach((node, offset) => {
              if (node.type.name === "paragraph" && node.content.size === 0) {
                const hint = docEmpty
                  ? prompt
                  : previous?.type.name === "heading"
                    ? (templateHintFor(previous.textContent) ?? "")
                    : "";
                if (hint) {
                  decorations.push(
                    Decoration.node(offset, offset + node.nodeSize, { class: "is-empty", "data-placeholder": hint }),
                  );
                }
              }
              previous = node;
            });
            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
