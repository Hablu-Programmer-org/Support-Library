import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/issues", () => ({
  createStudentIssueAction: vi.fn(async () => ({ fieldErrors: {} })),
}));

import { IssueReadinessPanel } from "@/components/issues/issue-readiness-panel";
import { StudentIssueForm } from "@/components/issues/student-issue-form";

import { editorOf, findIssueTextbox, stubEditorLayout } from "./support/editor-dom";

beforeAll(stubEditorLayout);
beforeEach(() => {
  Object.assign(URL, { createObjectURL: vi.fn(() => "blob:x"), revokeObjectURL: vi.fn() });
});

/** The desktop card; the mobile disclosure renders the same list. */
const desktop = () => screen.getByRole("region", { name: "Before you submit" });
const item = (id: string) => desktop().querySelector(`[data-readiness="${id}"]`)!;
const isDone = (id: string) => item(id).hasAttribute("data-done");

describe("IssueReadinessPanel", () => {
  it("counts required items only and says each item's state to screen readers", () => {
    render(
      <IssueReadinessPanel
        items={[
          { id: "title", label: "Title", done: true },
          { id: "details", label: "Details", done: false },
          { id: "screenshot", label: "Screenshot", done: true, optional: true },
        ]}
      />,
    );

    expect(within(desktop()).getByText("1 of 2 ready")).toBeInTheDocument();
    expect(item("title").textContent).toBe("Done: Title");
    expect(item("details").textContent).toBe("To do: Details");
    expect(item("screenshot").textContent).toBe("Done: Screenshot · optional");
    // Mobile disclosure shows the same progress in its summary.
    const summary = document.querySelector("details summary")!;
    expect(summary.textContent).toContain("1 of 2 ready");
    expect(document.querySelector("details")?.open).toBe(false);
  });
});

describe("StudentIssueForm live checklist", () => {
  const courses = [{ slug: "web", name: "Web Dev", batchNo: 3 }];

  it("ticks title, details, course and screenshot as the student fills the form", async () => {
    const { container } = render(<StudentIssueForm courses={courses} csrfToken="csrf" />);
    const box = await findIssueTextbox();
    expect(within(desktop()).getByText("0 of 3 ready")).toBeInTheDocument();

    fireEvent.change(container.querySelector('input[name="title"]')!, { target: { value: "Blank page" } });
    expect(isDone("title")).toBe(true);

    act(() => {
      editorOf(box).commands.insertContent("Too short");
    });
    expect(isDone("details")).toBe(false);
    act(() => {
      editorOf(box).commands.insertContent(" — the assignment page stays blank after I log in.");
    });
    expect(isDone("details")).toBe(true);

    fireEvent.change(container.querySelector('select[name="courseSlug"]')!, { target: { value: "web" } });
    expect(isDone("course")).toBe(true);
    expect(within(desktop()).getByText("3 of 3 ready")).toBeInTheDocument();

    expect(isDone("screenshot")).toBe(false);
    const files = container.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(files, "files", {
      value: [new File([new Uint8Array(8)], "error.png", { type: "image/png" })],
      configurable: true,
    });
    fireEvent.change(files);
    expect(isDone("screenshot")).toBe(true);
  });

  it("does not tick details for the bare template, and drops the course item without enrolments", async () => {
    render(<StudentIssueForm courses={[]} csrfToken="csrf" />);
    await findIssueTextbox();
    fireEvent.click(await screen.findByRole("button", { name: /Use template/ }));

    expect(isDone("details")).toBe(false);
    expect(desktop().querySelector('[data-readiness="course"]')).toBeNull();
    expect(within(desktop()).getByText("0 of 2 ready")).toBeInTheDocument();
  });

  it("puts screenshots under the editor, inside the details card", async () => {
    render(<StudentIssueForm courses={courses} csrfToken="csrf" />);
    const box = await findIssueTextbox();
    const card = screen.getByRole("heading", { name: "Describe your issue" }).closest("section")!;

    expect(card.contains(box)).toBe(true);
    const dropzone = within(card).getByRole("button", { name: "Add screenshots" });
    expect(box.compareDocumentPosition(dropzone) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
