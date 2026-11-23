import { render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/issues", () => ({
  createIssueAction: vi.fn(async () => ({ fieldErrors: {} })),
  updateIssueAction: vi.fn(async () => ({ fieldErrors: {} })),
}));
vi.mock("@/actions/lms", () => ({ lookupLmsStudentAction: vi.fn(async () => null) }));

import { IssueForm } from "@/components/issues/issue-form";

import { stubEditorLayout } from "./support/editor-dom";

beforeAll(stubEditorLayout);

const issue = {
  id: "665f1f77bcf86cd799439011",
  title: "Old issue",
  question: "The page is blank after login.",
  status: "PENDING",
  priority: "HIGH",
  courseSlug: "agent",
  batchNo: 9,
  tags: ["auth"],
  videoLinks: [],
  uploads: [{ id: "665f1f77bcf86cd799439099", originalName: "shot.png", byteSize: 2048 }],
  updatedAt: "2026-11-01T00:00:00.000Z",
};

function renderEdit(props: Partial<React.ComponentProps<typeof IssueForm>> = {}) {
  return render(
    <IssueForm
      csrfToken="csrf"
      supportIssue={issue}
      backHref="/dashboard/issues/665f1f77bcf86cd799439011?returnTo=x"
      {...props}
    />,
  );
}

describe("IssueForm edit layout", () => {
  it("puts status and priority in the Manage card with their saved values", () => {
    renderEdit();
    const manage = screen.getByRole("region", { name: "Manage" });
    expect(within(manage).getByLabelText(/Status/)).toHaveValue("PENDING");
    expect(within(manage).getByLabelText(/Priority/)).toHaveValue("HIGH");
  });

  it("has exactly one submit button and Back/Cancel go to the issue", () => {
    const { container } = renderEdit();
    expect(container.querySelectorAll('button[type="submit"]')).toHaveLength(1);
    expect(screen.getByRole("button", { name: /Save Issue/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Edit issue" })).toBeInTheDocument();
    for (const name of ["Back to issue", "Cancel"]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute(
        "href",
        "/dashboard/issues/665f1f77bcf86cd799439011?returnTo=x",
      );
    }
  });

  it("keeps the fields the update action reads", () => {
    const { container } = renderEdit();
    const names = ["title", "question", "status", "priority", "videoLinks", "courseSlug", "batchNo",
      "moduleSlug", "contentSlug", "tags", "studentName", "studentEmail", "expectedUpdatedAt",
      "csrfToken", "removeUploadIds"];
    for (const name of names) {
      expect(container.querySelector(`[name="${name}"]`), name).not.toBeNull();
    }
    expect(container.querySelector('[name="operationId"]')).toBeNull();
  });

  it("warns about unpublishing only when the issue is published", () => {
    const { unmount } = renderEdit();
    expect(screen.queryByText(/Saving moves it back to admin review/)).toBeNull();
    unmount();
    renderEdit({ isPublished: true });
    expect(screen.getByText(/Saving moves it back to admin review/)).toBeInTheDocument();
  });

  it("leaves the create form on its own layout", () => {
    render(<IssueForm minimal csrfToken="csrf" />);
    expect(screen.queryByRole("region", { name: "Manage" })).toBeNull();
    expect(screen.getByRole("button", { name: /Create Issue/ })).toBeInTheDocument();
  });
});
