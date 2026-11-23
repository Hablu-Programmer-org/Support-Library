import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { editReplyAction, deleteReplyAction } = vi.hoisted(() => ({
  editReplyAction: vi.fn(async (...args: [string, string, unknown, FormData]) => {
    void args;
    return { fieldErrors: { _form: ["Too many changes in a short time. Please wait a minute and try again."] } };
  }),
  deleteReplyAction: vi.fn(async () => ({})),
}));
vi.mock("@/actions/replies", () => ({ editReplyAction, deleteReplyAction }));

import { ReplyItem } from "@/components/issues/reply-item";
import { AttachmentField } from "@/components/shared/attachment-field";
import type { SupportReplyListItem } from "@/lib/services/replies";

import { editorOf, stubEditorLayout } from "./support/editor-dom";

beforeAll(stubEditorLayout);
beforeEach(() => {
  editReplyAction.mockClear();
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
});

const reply: SupportReplyListItem = {
  id: "reply-1",
  issueId: "issue-1",
  authorId: "staff-1",
  authorName: "Mentor",
  isStaffReply: true,
  body: "Run `npm ci` first.\n\n- then restart",
  videoLinks: [],
  uploads: [],
};

const slow = { timeout: 4000 };
const openEditor = async () => {
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  return screen.findByRole("textbox", { name: "Edit reply" }, slow);
};
const hiddenBody = (container: HTMLElement) =>
  container.querySelector('input[type="hidden"][name="body"]') as HTMLInputElement;

describe("ReplyItem edit", () => {
  it("opens the editor with the saved Markdown, formatted", async () => {
    const { container } = render(<ReplyItem issueId="issue-1" reply={reply} canEdit csrfToken="csrf" />);
    const box = await openEditor();

    expect(box.querySelector("code")?.textContent).toBe("npm ci");
    expect(box.querySelectorAll("li")).toHaveLength(1);
    expect(hiddenBody(container).value).toBe(reply.body);
    expect(container.querySelector("textarea[name='body']")).toBeNull();
  });

  it("refuses an empty reply and keeps a rejected edit in the editor", async () => {
    const { container } = render(<ReplyItem issueId="issue-1" reply={reply} canEdit csrfToken="csrf" />);
    const box = await openEditor();
    const form = box.closest("form")!;

    act(() => {
      editorOf(box).commands.clearContent(true);
    });
    fireEvent.submit(form);
    expect(await screen.findByText("A reply can't be empty. Delete it instead.")).toBeInTheDocument();
    expect(editReplyAction).not.toHaveBeenCalled();

    act(() => {
      editorOf(box).commands.insertContent("Edited text");
    });
    fireEvent.submit(form);
    expect(await screen.findByText(/Too many changes/)).toBeInTheDocument();
    expect(editReplyAction.mock.calls[0][3].get("body")).toBe("Edited text");
    await waitFor(() => expect(hiddenBody(container).value).toBe("Edited text"));
  });

  it("keeps a pasted screenshot in the edit form, never in another form", async () => {
    const { container } = render(
      <>
        <ReplyItem issueId="issue-1" reply={reply} canEdit csrfToken="csrf" />
        <form aria-label="composer">
          <AttachmentField />
        </form>
      </>,
    );
    const box = await openEditor();
    const event = new Event("paste", { bubbles: true, cancelable: true });
    const file = new File([new Uint8Array(8)], "shot.png", { type: "image/png" });
    Object.defineProperty(event, "clipboardData", {
      value: { files: [file], types: ["Files"], items: [], getData: () => "" },
    });
    act(() => {
      box.dispatchEvent(event);
    });

    const editForm = container.querySelector('[data-testid="reply-reply-1"] form')!;
    await waitFor(() => expect(editForm.querySelectorAll("img").length).toBeGreaterThan(0));
    expect(screen.getByRole("form", { name: "composer" }).querySelectorAll("img")).toHaveLength(0);
  });

  it("edits in place: the read view is hidden while the editor is open", async () => {
    const { container } = render(<ReplyItem issueId="issue-1" reply={reply} canEdit csrfToken="csrf" />);
    const card = container.querySelector('[data-testid="reply-reply-1"]')!;
    expect(card.querySelectorAll("code")).toHaveLength(1);
    await openEditor();
    expect(card).toHaveAttribute("data-editing", "true");
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("asks before discarding changes and closes straight away when nothing changed", async () => {
    render(<ReplyItem issueId="issue-1" reply={reply} canEdit csrfToken="csrf" />);
    await openEditor();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("textbox", { name: "Edit reply" })).toBeNull();

    const box = await openEditor();
    act(() => {
      editorOf(box).commands.insertContent("More");
    });
    fireEvent.keyDown(box.closest("form")!, { key: "Escape" });
    expect(screen.getByText("Discard your changes?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("textbox", { name: "Edit reply" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.queryByRole("textbox", { name: "Edit reply" })).toBeNull();
  });

  it("saves with Ctrl+Enter and sends expectedUpdatedAt and new images", async () => {
    const { container } = render(
      <ReplyItem
        issueId="issue-1"
        reply={{ ...reply, updatedAt: new Date("2026-11-01T00:00:00.000Z") }}
        canEdit
        csrfToken="csrf"
      />,
    );
    const box = await openEditor();
    const form = box.closest("form")!;
    expect(form.querySelector('input[type="file"][name="uploads"]')).not.toBeNull();
    fireEvent.keyDown(form, { key: "Enter", ctrlKey: true });
    await waitFor(() => expect(editReplyAction).toHaveBeenCalled());
    const sent = editReplyAction.mock.calls[0][3];
    expect(sent.get("expectedUpdatedAt")).toBe("2026-11-01T00:00:00.000Z");
    expect(container).toBeTruthy();
  });
});

describe("ReplyItem delete", () => {
  it("only deletes after the inline confirmation", async () => {
    render(<ReplyItem issueId="issue-1" reply={reply} canEdit csrfToken="csrf" />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(screen.getByText(/Delete this reply\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Keep reply" }));
    expect(screen.queryByText(/Delete this reply\?/)).toBeNull();
    expect(deleteReplyAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete reply" }));
    await waitFor(() => expect(deleteReplyAction).toHaveBeenCalled());
  });
});
