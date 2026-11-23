import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { addStudentReplyAction } = vi.hoisted(() => ({
  addStudentReplyAction: vi.fn(async (...args: [string, unknown, FormData]) => {
    void args;
    return { fieldErrors: { _form: ["Too many changes in a short time. Please wait a minute and try again."] } };
  }),
}));
vi.mock("@/actions/replies", () => ({ addStudentReplyAction }));

import { StudentReplyComposer } from "@/components/issues/student-reply-composer";

import { editorOf, stubEditorLayout } from "./support/editor-dom";

beforeAll(stubEditorLayout);
beforeEach(() => addStudentReplyAction.mockClear());

const messageBox = () => screen.findByRole("textbox", { name: "Message" });
const hiddenBody = (container: HTMLElement) =>
  container.querySelector('input[type="hidden"][name="body"]') as HTMLInputElement;

describe("StudentReplyComposer", () => {
  it("submits the editor's Markdown with an operation id", async () => {
    const { container } = render(<StudentReplyComposer issueId="issue-1" csrfToken="csrf" />);
    const box = await messageBox();
    expect(container.querySelector("textarea[name='body']")).toBeNull();

    act(() => {
      editorOf(box).commands.setContent("Still failing:\n\n```\nTypeError: x is undefined\n```", {
        contentType: "markdown",
        emitUpdate: true,
      });
    });
    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(addStudentReplyAction).toHaveBeenCalledTimes(1));
    const data = addStudentReplyAction.mock.calls[0][2];
    expect(data.get("body")).toBe("Still failing:\n\n```\nTypeError: x is undefined\n```");
    expect(data.get("operationId")).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("blocks an empty message and focuses the editor", async () => {
    const { container } = render(<StudentReplyComposer issueId="issue-1" csrfToken="csrf" />);
    const box = await messageBox();

    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("Write your message before sending.")).toBeInTheDocument();
    await waitFor(() => expect(editorOf(box).isFocused).toBe(true));
    expect(addStudentReplyAction).not.toHaveBeenCalled();
  });

  it("keeps the message after the server rejects it", async () => {
    const { container } = render(<StudentReplyComposer issueId="issue-1" csrfToken="csrf" />);
    const box = await messageBox();
    act(() => {
      editorOf(box).commands.insertContent("New detail: it only fails on Firefox.");
    });

    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText(/Too many changes in a short time/)).toBeInTheDocument();
    expect(hiddenBody(container).value).toBe("New detail: it only fails on Firefox.");
    expect(box.textContent).toBe("New detail: it only fails on Firefox.");
  });
});
