import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { addReplyAction } = vi.hoisted(() => ({
  addReplyAction: vi.fn(async (...args: [string, unknown, FormData]) => {
    void args;
    return { fieldErrors: { _form: ["Unable to save the response. Please try again."] } };
  }),
}));
vi.mock("@/actions/replies", () => ({ addReplyAction }));

import { replyBodyProblem } from "@/components/issues/reply-body-field";
import { ReplyComposer } from "@/components/issues/reply-composer";

import { editorOf, stubEditorLayout } from "./support/editor-dom";

beforeAll(stubEditorLayout);
beforeEach(() => addReplyAction.mockClear());

const responseBox = () => screen.findByRole("textbox", { name: "Response" }, { timeout: 4000 });
const hiddenBody = (container: HTMLElement) =>
  container.querySelector('input[type="hidden"][name="body"]') as HTMLInputElement;

describe("replyBodyProblem", () => {
  it("mirrors the server's trim/min(1)/max(20,000) rule", () => {
    expect(replyBodyProblem("   ")).toMatch(/Write the response/);
    expect(replyBodyProblem("   ", { required: false })).toBeNull();
    expect(replyBodyProblem("ok")).toBeNull();
    expect(replyBodyProblem(`  ${"x".repeat(20_000)}  `)).toBeNull();
    expect(replyBodyProblem("x".repeat(20_001), { required: false })).toMatch(/20,000 characters or fewer/);
  });
});

describe("ReplyComposer", () => {
  it("carries CSRF and an operation id for the server action", () => {
    const { container } = render(<ReplyComposer issueId="issue-1" csrfToken="csrf-token" />);

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    const data = new FormData(form!);
    expect(data.get("csrfToken")).toBe("csrf-token");
    expect(form!.querySelector('input[name="operationId"]')).not.toBeNull();
  });

  it("writes the response in the editor and submits it as Markdown", async () => {
    const { container } = render(<ReplyComposer issueId="issue-1" csrfToken="csrf-token" />);
    const box = await responseBox();
    expect(container.querySelector("textarea[name='body']")).toBeNull();

    act(() => {
      editorOf(box).commands.setContent("Run `npm ci`, then **restart**.", { contentType: "markdown", emitUpdate: true });
    });
    expect(hiddenBody(container).value).toBe("Run `npm ci`, then **restart**.");

    fireEvent.submit(container.querySelector("form")!);
    await waitFor(() => expect(addReplyAction).toHaveBeenCalledTimes(1));
    expect(addReplyAction.mock.calls[0][2].get("body")).toBe("Run `npm ci`, then **restart**.");
  });

  it("blocks an empty response, says why and focuses the editor", async () => {
    const { container } = render(<ReplyComposer issueId="issue-1" csrfToken="csrf-token" />);
    const box = await responseBox();

    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText("Write the response before sending.")).toBeInTheDocument();
    expect(box.getAttribute("aria-invalid")).toBe("true");
    await waitFor(() => expect(editorOf(box).isFocused).toBe(true));
    expect(addReplyAction).not.toHaveBeenCalled();

    act(() => {
      editorOf(box).commands.insertContent("Now there is text.");
    });
    expect(screen.queryByText("Write the response before sending.")).toBeNull();
  });

  it("renders a failed save as an inline alert and keeps the response", async () => {
    const { container } = render(<ReplyComposer issueId="issue-1" csrfToken="csrf-token" />);
    const box = await responseBox();
    act(() => {
      editorOf(box).commands.insertContent("Half-written response");
    });

    fireEvent.submit(container.querySelector("form")!);

    const alert = await screen.findByText("Unable to save the response. Please try again.");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(hiddenBody(container).value).toBe("Half-written response");
    expect(box.textContent).toBe("Half-written response");
  });
});
