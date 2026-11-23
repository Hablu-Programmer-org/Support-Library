import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRef, useState } from "react";
import { beforeAll, describe, expect, it, vi } from "vitest";

const { createStudentIssueAction } = vi.hoisted(() => ({
  createStudentIssueAction: vi.fn(async () => ({ fieldErrors: {} })),
}));
vi.mock("@/actions/issues", () => ({ createStudentIssueAction }));

import { IssueEditor, type IssueEditorApi } from "@/components/issues/issue-editor";
import { issueDetailsProblem, StudentIssueForm } from "@/components/issues/student-issue-form";

import { editorOf, findIssueTextbox, stubEditorLayout } from "./support/editor-dom";

beforeAll(stubEditorLayout);

const textbox = findIssueTextbox;
const hiddenQuestion = (container: HTMLElement) =>
  container.querySelector('input[type="hidden"][name="question"]') as HTMLInputElement;

function Harness({ initial = "", invalid = false }: { initial?: string; invalid?: boolean }) {
  const [value, setValue] = useState(initial);
  const api = useRef<IssueEditorApi | null>(null);
  return (
    <form aria-label="harness">
      <IssueEditor
        id="q"
        name="question"
        label="Issue details"
        value={value}
        onChange={setValue}
        required
        invalid={invalid}
        apiRef={api}
        placeholder="What happened?"
        footer={<span>{value.length} chars</span>}
      />
    </form>
  );
}

describe("IssueEditor", () => {
  it("shows a skeleton first, then an accessible textbox", async () => {
    const { container } = render(<Harness />);
    expect(container.querySelector("[data-issue-editor-skeleton]")).not.toBeNull();

    const box = await textbox();
    expect(container.querySelector("[data-issue-editor-skeleton]")).toBeNull();
    expect(box.getAttribute("contenteditable")).toBe("true");
    expect(box.getAttribute("aria-multiline")).toBe("true");
    expect(box.getAttribute("aria-required")).toBe("true");
    expect(box.getAttribute("aria-invalid")).toBe("false");
    expect(box.getAttribute("aria-describedby")).toBe("q-footer");
    expect(box.getAttribute("aria-placeholder")).toBe("What happened?");
  });

  it("submits Markdown through a hidden input and never renders a textarea", async () => {
    const { container } = render(<Harness />);
    const box = await textbox();
    expect(container.querySelector("textarea")).toBeNull();
    expect(hiddenQuestion(container).value).toBe("");

    act(() => {
      editorOf(box).chain().insertContent("Run ").insertContent({ type: "text", text: "npm run dev", marks: [{ type: "code" }] }).run();
    });

    expect(hiddenQuestion(container).value).toBe("Run `npm run dev`");
    expect(screen.getByText("17 chars")).toBeInTheDocument();
  });

  it("starts from existing Markdown and shows it formatted", async () => {
    const { container } = render(<Harness initial={"**Bold** step\n\n- one\n- two"} />);
    const box = await textbox();

    expect(box.querySelector("strong")?.textContent).toBe("Bold");
    expect(box.querySelectorAll("li")).toHaveLength(2);
    expect(hiddenQuestion(container).value).toBe("**Bold** step\n\n- one\n- two");
  });

  it("reflects the invalid state on the textbox", async () => {
    const { rerender } = render(<Harness invalid={false} />);
    const box = await textbox();
    rerender(<Harness invalid />);

    await waitFor(() => expect(box.getAttribute("aria-invalid")).toBe("true"));
  });

  it("focuses the editor when the label is clicked", async () => {
    render(<Harness />);
    const box = await textbox();
    fireEvent.click(screen.getByText("Issue details"));

    await waitFor(() => expect(editorOf(box).isFocused).toBe(true));
  });
});

describe("issueDetailsProblem", () => {
  it("mirrors the server rules", () => {
    expect(issueDetailsProblem("   ")).toMatch(/Describe your issue/);
    expect(issueDetailsProblem("Page broken")).toMatch(/at least 40/);
    // Whitespace padding does not count towards the minimum.
    expect(issueDetailsProblem(`short ${" ".repeat(60)} text`)).toMatch(/at least 40/);
    expect(issueDetailsProblem("The assignment page shows a blank screen after login.")).toBeNull();
    expect(issueDetailsProblem("x".repeat(20_001))).toMatch(/20,000 characters or fewer/);
  });
});

describe("StudentIssueForm details validation", () => {
  const renderForm = () =>
    render(<StudentIssueForm courses={[]} csrfToken="csrf-1" />);

  it("blocks a too-short submit, shows why and focuses the editor", async () => {
    createStudentIssueAction.mockClear();
    const { container } = renderForm();
    const box = await textbox();
    act(() => {
      editorOf(box).commands.insertContent("Page broken");
    });

    fireEvent.submit(container.querySelector("form")!);

    expect(await screen.findByText(/Add at least 40 characters so the support team/)).toBeInTheDocument();
    expect(box.getAttribute("aria-invalid")).toBe("true");
    await waitFor(() => expect(editorOf(box).isFocused).toBe(true));
    expect(createStudentIssueAction).not.toHaveBeenCalled();
  });

  it("clears the error as soon as the details are long enough", async () => {
    const { container } = renderForm();
    const box = await textbox();
    fireEvent.submit(container.querySelector("form")!);
    expect(await screen.findByText(/Describe your issue so the support team/)).toBeInTheDocument();

    act(() => {
      editorOf(box).commands.insertContent("The assignment page shows a blank screen after login.");
    });

    expect(screen.queryByText(/Describe your issue so the support team/)).toBeNull();
    expect(box.getAttribute("aria-invalid")).toBe("false");
  });

  it("sends the editor's Markdown to the server action", async () => {
    createStudentIssueAction.mockClear();
    const { container } = renderForm();
    const box = await textbox();
    act(() => {
      editorOf(box).commands.setContent("The **assignment** page shows a blank screen after login.", { contentType: "markdown", emitUpdate: true });
    });
    fireEvent.change(container.querySelector('input[name="title"]')!, { target: { value: "Blank assignment page" } });

    fireEvent.submit(container.querySelector("form")!);

    await waitFor(() => expect(createStudentIssueAction).toHaveBeenCalledTimes(1));
    const calls = createStudentIssueAction.mock.calls as unknown as Array<[unknown, FormData]>;
    expect(calls[0][1].get("question")).toBe("The **assignment** page shows a blank screen after login.");
  });

  it("disables submit while the Markdown is over the server limit", async () => {
    renderForm();
    const box = await textbox();
    const submit = screen.getByRole("button", { name: "Create issue" });
    expect(submit).toBeEnabled();

    act(() => {
      editorOf(box).commands.insertContent("x".repeat(20_001));
    });

    expect(submit).toBeDisabled();
    expect(screen.getByText("Shorten by 1 characters.")).toBeInTheDocument();
  });
});
