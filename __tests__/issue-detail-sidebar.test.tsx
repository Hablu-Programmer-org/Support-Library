import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

// The forms have their own tests; here only "is it rendered, with which props".
vi.mock("@/components/issues/issue-status-form", () => ({
  IssueStatusForm: (props: { autoPublish?: boolean }) => (
    <div data-testid="status-form" data-auto-publish={String(Boolean(props.autoPublish))} />
  ),
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
  it("admin gets Manage (with Publish) first, then context, student and danger zone", () => {
    renderSidebar({ canEdit: true, canPublish: true, staff });
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Manage issue", "Issue context", "Student snapshot", "Archive this issue"]);
    expect(screen.getByTestId("status-form").getAttribute("data-auto-publish")).toBe("true");
    expect(screen.getByTestId("publish-form")).toBeTruthy();
    expect(screen.getByText("karim@example.com")).toBeTruthy();
    expect(screen.getByText("Live support")).toBeTruthy();
  });

  it("mentor gets Manage without Publish", () => {
    renderSidebar({ canEdit: true, canPublish: false, staff });
    expect(screen.getByTestId("status-form").getAttribute("data-auto-publish")).toBe("false");
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

  it("falls back to 'Not specified' for missing course, batch and publish date", () => {
    renderSidebar({ courseSlug: null, batchNo: null, publishedAt: null });
    expect(screen.getAllByText("Not specified")).toHaveLength(3);
  });

  it("labels a staff case without a student as a general issue", () => {
    renderSidebar({ canEdit: true, staff: { studentName: "", studentEmail: null } });
    expect(screen.getByText("General issue (no student)")).toBeTruthy();
    expect(screen.getByText("No student identity recorded")).toBeTruthy();
  });

  it("no longer repeats Reference or Created, which live in the header", () => {
    renderSidebar({ canEdit: true, staff });
    expect(screen.queryByText("Reference")).toBeNull();
    expect(screen.queryByText("Created")).toBeNull();
  });
});
