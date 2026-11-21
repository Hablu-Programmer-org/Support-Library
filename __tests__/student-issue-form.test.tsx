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
        "videoLinks",
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

  it("keeps the client-side limits on title and details", () => {
    const { container } = renderForm();
    const title = container.querySelector('input[name="title"]') as HTMLInputElement;
    const details = container.querySelector('textarea[name="question"]') as HTMLTextAreaElement;
    expect(title.required).toBe(true);
    expect(title.maxLength).toBe(80);
    expect(details.required).toBe(true);
    expect(details.minLength).toBe(40);
    expect(details.maxLength).toBe(20_000);
  });

  it("groups the form into titled sections", () => {
    renderForm();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Describe your issue", "Screenshots", "Course context"]);
  });

  it("keeps optional details closed by default", () => {
    const { container } = renderForm();
    const optional = container.querySelector("details");
    expect(optional?.open).toBe(false);
    expect(optional?.querySelector('[name="tags"]')).not.toBeNull();
  });

  it("does not repeat the 'After creating it' line under the form", () => {
    renderForm();
    expect(screen.queryByText(/After creating it/)).toBeNull();
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
