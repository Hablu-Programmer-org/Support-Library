import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/issues", () => ({
  createStudentIssueAction: vi.fn(async () => ({ fieldErrors: {} })),
}));

import { StudentIssueForm } from "@/components/issues/student-issue-form";

const courses = [
  { slug: "agent", name: "AI Agent", batchNo: 11 },
  { slug: "web", name: "Web Dev", batchNo: 0 },
];

const renderForm = (list = courses) => render(<StudentIssueForm courses={list} csrfToken="csrf-1" />);

describe("StudentIssueForm layout", () => {
  it("keeps every field name the server action reads", () => {
    const { container } = renderForm();
    const names = Array.from(container.querySelectorAll("form [name]")).map((el) => el.getAttribute("name"));
    expect(names).toEqual(
      expect.arrayContaining([
        "operationId",
        "csrfToken",
        "title",
        "question",
        "uploads",
        "courseSlug",
        "moduleSlug",
        "contentSlug",
        "tags",
      ]),
    );
    expect((container.querySelector('input[name="csrfToken"]') as HTMLInputElement).value).toBe("csrf-1");
  });

  it("never sends the batch: it is display-only and derived on the server", () => {
    const { container } = renderForm();
    expect(container.querySelector('[name="batchNo"]')).toBeNull();
    const batch = screen.getByLabelText("Batch (filled from your enrolment)") as HTMLInputElement;
    expect(batch.readOnly).toBe(true);
    expect(batch.hasAttribute("name")).toBe(false);
  });

  it("keeps the client-side title limits and sends details as hidden Markdown", () => {
    const { container } = renderForm();
    const title = container.querySelector('input[name="title"]') as HTMLInputElement;
    expect(title.required).toBe(true);
    expect(title.maxLength).toBe(80);
    // Details limits are checked on submit (issue-editor.test.tsx): a hidden
    // input has no native required/minLength.
    const details = container.querySelector('[name="question"]') as HTMLInputElement;
    expect(details.tagName).toBe("INPUT");
    expect(details.type).toBe("hidden");
    expect(container.querySelector("textarea[name='question']")).toBeNull();
  });

  it("groups the form into titled sections", () => {
    renderForm();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    // Screenshots now sit under the editor inside "Describe your issue"; the
    // checklist beside the form has its own heading.
    expect(headings).toEqual(["Describe your issue", "Course context", "Before you submit"]);
  });

  it("keeps optional details closed by default", () => {
    const { container } = renderForm();
    const optional = container.querySelector("details");
    expect(optional?.open).toBe(false);
    expect(optional?.querySelector('[name="tags"]')).not.toBeNull();
  });

  it("keeps the 'After creating it' line in the checklist, never in the form", () => {
    const { container } = renderForm();
    expect(container.querySelector("form")?.textContent).not.toMatch(/After creating it/);
    expect(container.querySelector("aside")?.textContent).toMatch(/After creating it/);
  });

  it("falls back to a notice when the student has no course", () => {
    const { container } = renderForm([]);
    expect(container.querySelector('[name="courseSlug"]')).toBeNull();
    expect(screen.getByText(/could not find a course/)).toBeTruthy();
  });

  it("has one Create issue submit button", () => {
    renderForm();
    const submit = screen.getByRole("button", { name: "Create issue" });
    expect(submit.getAttribute("type")).toBe("submit");
  });
});
