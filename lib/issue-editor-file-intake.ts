import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Extension } from "@tiptap/react";

type FileIntakeOptions = {
  /** Files pasted or dropped on the editor; they go to the attachment field. */
  onFiles: (files: File[], source: HTMLElement) => void;
};

/**
 * The issue editor has no image node: screenshots stay private attachments
 * until the team publishes the issue. Pasted or dropped files are handed to
 * `onFiles` and nothing is inserted into the document.
 *
 * A paste that also carries text is left alone: Word, Excel and Sheets put a
 * PNG of the selection on the clipboard next to the text the student meant to
 * paste. Screenshot tools and "Copy image" put only the image there.
 */
export const IssueFileIntake = Extension.create<FileIntakeOptions>({
  name: "issueFileIntake",
  addOptions: () => ({ onFiles: () => {} }),
  addProseMirrorPlugins() {
    const { options } = this;
    return [
      new Plugin({
        key: new PluginKey("issueFileIntake"),
        props: {
          handlePaste: (view, event) => {
            const data = event.clipboardData;
            const files = data ? Array.from(data.files) : [];
            if (!files.length || data?.getData("text/plain").trim()) return false;
            event.preventDefault();
            options.onFiles(files, view.dom);
            return true;
          },
          handleDOMEvents: {
            // A DOM handler, not `handleDrop`: ProseMirror only calls that when
            // the pointer maps to a document position, so a drop on the
            // editor's padding would skip it.
            drop: (view, event) => {
              const files = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
              if (!files.length) return false;
              event.preventDefault();
              // The page-wide drop listener of AttachmentField would add them again.
              event.stopPropagation();
              options.onFiles(files, view.dom);
              return true;
            },
          },
        },
      }),
    ];
  },
});
