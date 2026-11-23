import type { Editor } from "@tiptap/react";
import { screen } from "@testing-library/react";

/**
 * jsdom has no layout; ProseMirror measures the caret to scroll it into view
 * on focus. Call from `beforeAll` in tests that mount a Tiptap editor.
 */
export function stubEditorLayout() {
  const rects = () => Object.assign([] as DOMRect[], { item: () => null }) as unknown as DOMRectList;
  const rect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({}) }) as DOMRect;
  Range.prototype.getClientRects ??= rects;
  Range.prototype.getBoundingClientRect ??= rect;
  for (const proto of [Element.prototype, Text.prototype] as Array<{ getClientRects?: () => DOMRectList }>) {
    proto.getClientRects ??= rects;
  }
}

/** Tiptap stores its instance on the editable element. */
export const editorOf = (element: HTMLElement) => (element as HTMLElement & { editor: Editor }).editor;

export const findIssueTextbox = () => screen.findByRole("textbox", { name: /Issue details/ });
