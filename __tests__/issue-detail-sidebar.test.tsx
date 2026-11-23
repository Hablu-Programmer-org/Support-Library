import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The forms have their own tests; here only "is it rendered, with which props".
vi.mock("@/components/issues/issue-status-form", () => ({
  IssueStatusForm: () => <div data-testid="status-form" />,
}));
vi.mock("@/components/issues/publish-issue-form", () => ({
  PublishIssueForm: () => <div data-testid="publish-form" />,
}));
vi.mock("@/components/issues/archive-issue-button", () => ({
  ArchiveIssueButton: () => <button type="submit">Archive issue</button>,
}));

import { IssueDetailSidebar } from "@/components/issues/issue-detail-sidebar";

type Props = Parameters<typeof IssueDetailSidebar>[0];

const base: Props = {
  issueId: "issue-1",
  status: "OPEN",
  caseRef: "HSL-1042",
  isPublished: false,
  updatedAtIso: "2026-11-21T06:03:00.000Z",
  courseSlug: "agent",
  batchNo: 9,
  publishedAt: new Date("2026-11-21T06:03:00Z"),
  csrfToken: "csrf",
  canEdit: false,
  canPublish: false,
  staff: null,
  statusOptions: [{ value: "OPEN", label: "Open" }],
  archiveAction: vi.fn(async () => ({})),
};

const staff = {
  studentName: "Karim",
  studentEmail: "karim@example.com",
  lastLiveSupportAt: new Date("2026-11-20T10:00:00Z"),
};

const renderSidebar = (extra: Partial<Props> = {}) =>
  render(<IssueDetailSidebar {...base} {...extra} />);

describe("IssueDetailSidebar roles", () => {
  it("admin gets student, context, Manage (with Publish), then the danger zone", () => {
    renderSidebar({ canEdit: true, canPublish: true, staff });
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Student snapshot", "Issue context", "Manage issue", "Archive this issue"]);
    expect(screen.getByTestId("status-form")).toBeTruthy();
    expect(screen.getAllByTestId("publish-form")).toHaveLength(1);
    expect(screen.getByText("karim@example.com")).toBeTruthy();
    expect(screen.getByText("Live support")).toBeTruthy();
  });

  it("mentor gets Manage without Publish", () => {
    renderSidebar({ canEdit: true, canPublish: false, staff });
    expect(screen.getByTestId("status-form")).toBeTruthy();
    expect(screen.queryByTestId("publish-form")).toBeNull();
  });

  it("public viewer sees only the issue context", () => {
    renderSidebar();
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Issue context"]);
    expect(screen.queryByTestId("status-form")).toBeNull();
    expect(screen.queryByRole("button", { name: "Archive issue" })).toBeNull();
    expect(screen.queryByText("Live support")).toBeNull();
  });

  it("never shows student identity or staff controls to a non-staff viewer, even if passed", () => {
    renderSidebar({ canEdit: false, canPublish: true, staff });
    expect(screen.queryByText("Karim")).toBeNull();
    expect(screen.queryByText("karim@example.com")).toBeNull();
    expect(screen.queryByText("Live support")).toBeNull();
    expect(screen.queryByTestId("publish-form")).toBeNull();
    expect(screen.queryByText("Danger zone")).toBeNull();
  });
});

describe("IssueDetailSidebar content", () => {
  it("keeps the danger zone closed until its summary is opened", () => {
    const { container } = renderSidebar({ canEdit: true, staff });
    const details = container.querySelector("details");
    expect(details?.open).toBe(false);
    // Still discoverable while closed, and still the section the e2e styles check targets.
    const heading = screen.getByRole("heading", { name: "Archive this issue" });
    expect(heading.closest("section")?.className).toContain("border-danger-300");
    expect(heading.className).toContain("dark:text-slate-50");

    fireEvent.click(heading.closest("summary")!);
    expect(details?.open).toBe(true);
  });

  it("falls back for a missing reference, course, batch and publish date", () => {
    renderSidebar({ caseRef: null, courseSlug: null, batchNo: null, publishedAt: null });
    expect(screen.getAllByText("Not specified")).toHaveLength(3);
    expect(screen.getByText("Not published")).toBeTruthy();
  });

  it("shows the reference first in Issue context, copyable, for every viewer", () => {
    for (const extra of [{}, { canEdit: true, staff }, { canEdit: true, canPublish: true, staff }]) {
      const { unmount } = renderSidebar(extra);
      const terms = screen.getAllByRole("term").map((t) => t.textContent);
      expect(terms[0]).toBe("Reference");
      expect(screen.getByText("HSL-1042")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Copy reference" })).toBeTruthy();
      unmount();
    }
  });

  it("shows a library reader only course and batch", () => {
    renderSidebar({ reader: true });
    const terms = screen.getAllByRole("term").map((t) => t.textContent);
    expect(terms).toEqual(["Course", "Batch"]);
    expect(screen.queryByRole("button", { name: "Copy reference" })).toBeNull();
  });

  it("renders extra cards (live support) after the context and no Manage without options", () => {
    renderSidebar({ canEdit: true, statusOptions: undefined, children: <section><h2>Live support</h2></section> });
    expect(screen.queryByTestId("status-form")).toBeNull();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings.indexOf("Live support")).toBeGreaterThan(headings.indexOf("Issue context"));
  });

  it("labels a staff case without a student as a general issue", () => {
    renderSidebar({ canEdit: true, staff: { studentName: "", studentEmail: null } });
    expect(screen.getByText("General issue (no student)")).toBeTruthy();
    expect(screen.getByText("No student identity recorded")).toBeTruthy();
  });

  it("does not repeat Created, which lives in the header", () => {
    renderSidebar({ canEdit: true, staff });
    expect(screen.queryByText("Created")).toBeNull();
  });
});

describe("IssueDetailSidebar parts (phone order on the case page)", () => {
  it("part=top renders student, context and Manage, without the danger zone", () => {
    renderSidebar({ canEdit: true, canPublish: true, staff, part: "top" });
    const top = screen.getByRole("complementary", { name: "Issue sidebar" });
    expect(top.textContent).toContain("Manage issue");
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Student snapshot", "Issue context", "Manage issue"]);
    expect(screen.queryByText("Danger zone")).toBeNull();
  });

  it("part=bottom leaves the top cards out, so the forms exist once on the page", () => {
    renderSidebar({ canEdit: true, canPublish: true, staff, part: "bottom" });
    expect(screen.queryByTestId("status-form")).toBeNull();
    expect(screen.queryByTestId("publish-form")).toBeNull();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Archive this issue"]);
  });

  it("part=bottom renders nothing for a non-staff viewer", () => {
    const { container } = renderSidebar({ part: "bottom" });
    expect(container.innerHTML).toBe("");
  });

  it("passes layout classes through", () => {
    renderSidebar({ canEdit: true, staff, part: "top", className: "lg:col-start-2" });
    expect(screen.getByRole("complementary", { name: "Issue sidebar" }).className).toContain("lg:col-start-2");
  });
});

describe("IssueDetailSidebar student photo", () => {
  it("shows the student's profile photo when one is known", () => {
    const { container } = renderSidebar({
      canEdit: true,
      staff: { ...staff, studentImage: "https://lh3.googleusercontent.com/a/photo" },
    });
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain("lh3.googleusercontent.com");
  });

  it("falls back to initials without a photo", () => {
    const { container } = renderSidebar({ canEdit: true, staff: { ...staff, studentName: "Akash Khan" } });
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("AK")).toBeTruthy();
  });
});
