import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/replies", () => ({
  editReplyAction: vi.fn(async () => ({})),
  deleteReplyAction: vi.fn(async () => ({})),
}));
vi.mock("@/lib/live-support", () => ({
  getLiveSupportConfig: () => ({ platform: "Zoom", meetingId: "1", passcode: "p", joinUrl: "https://x" }),
}));
// Each has its own tests; here only "is it on the page, in the right place".
vi.mock("@/components/live-support/live-support-panel", () => ({
  LiveSupportPanel: () => (
    <section>
      <h2>Live support</h2>
    </section>
  ),
}));
vi.mock("@/components/issues/my-requests-refresh", () => ({
  MyRequestsRefresh: () => <button type="button">Refresh</button>,
}));
// Staff-only sidebar forms import server actions (next-auth); the student view
// never renders them, and the "shows no staff-only tools" case proves it.
vi.mock("@/components/issues/issue-status-form", () => ({ IssueStatusForm: () => <div>status form</div> }));
vi.mock("@/components/issues/publish-issue-form", () => ({ PublishIssueForm: () => <div>publish form</div> }));
vi.mock("@/components/issues/archive-issue-button", () => ({ ArchiveIssueButton: () => <div>archive</div> }));
vi.mock("@/components/issues/student-reply-composer", () => ({
  StudentReplyComposer: () => <form aria-label="Follow-up" />,
}));

import { StudentRequestView } from "@/components/issues/student-request-view";
import type { OwnIssueDetail } from "@/lib/services/issues";
import type { SupportReplyListItem } from "@/lib/services/replies";

const issue: OwnIssueDetail = {
  id: "issue-1",
  title: "Supabase 403 on insert",
  question: "## Error\n\npermission denied",
  videoLinks: [],
  uploads: [],
  status: "SOLVED",
  courseSlug: "agent",
  batchNo: 9,
  tags: [],
  visibility: "INTERNAL",
  publishedAt: null,
  caseRef: "HSL-1042",
  createdAt: new Date("2026-11-21T05:58:00Z"),
  updatedAt: new Date("2026-11-21T06:03:00Z"),
} as OwnIssueDetail;

// Owner projection: author ids are blanked, staff names kept.
const staffAnswer: SupportReplyListItem = {
  id: "r1",
  issueId: "issue-1",
  authorId: "",
  authorName: "Rahim",
  isStaffReply: true,
  body: "Use the service_role key",
  videoLinks: [],
  uploads: [],
  createdAt: new Date("2026-11-21T06:03:00Z"),
};
const ownFollowUp: SupportReplyListItem = {
  ...staffAnswer,
  id: "r2",
  authorName: "Karim",
  isStaffReply: false,
  body: "Thanks, that fixed it",
};

type Props = Parameters<typeof StudentRequestView>[0];
const renderView = (extra: Partial<Props> = {}) =>
  render(
    <StudentRequestView
      issue={issue}
      replies={[staffAnswer, ownFollowUp]}
      csrfToken="csrf"
      created={false}
      activityRevision="rev"
      viewerId="student-1"
      {...extra}
    />,
  );

describe("StudentRequestView (new layout)", () => {
  it("uses the shared header, Issue details, Responses and Issue context", () => {
    renderView();
    expect(screen.getByRole("heading", { level: 1, name: "Supabase 403 on insert" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Back to my issues" }).getAttribute("href")).toBe("/dashboard/my-issues");
    expect(screen.getByRole("button", { name: "Refresh" })).toBeTruthy();
    // RTL matches a string name exactly, so this does not also hit another heading.
    expect(screen.getByRole("heading", { name: "Issue details" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Responses" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Issue context" })).toBeTruthy();
    // The student's question is markdown too.
    expect(screen.getByRole("heading", { name: "Error" })).toBeTruthy();
  });

  it("shows the reference in Issue context and no triage priority", () => {
    renderView();
    expect(screen.getByText("HSL-1042")).toBeTruthy();
    expect(screen.queryByText(/priority/i)).toBeNull();
  });

  it("signs the team's answer with the mentor's name and the student's own reply as You", () => {
    renderView();
    const [answer, followUp] = screen.getAllByRole("article");
    expect(within(answer).getByText("Rahim")).toBeTruthy();
    expect(within(answer).getByText("Solution")).toBeTruthy();
    expect(within(followUp).getByText("You")).toBeTruthy();
    expect(screen.queryByText("Karim")).toBeNull();
  });

  it("never offers edit or delete on the student's view", () => {
    renderView();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("puts live support in the sidebar after Issue context", () => {
    renderView();
    const sidebar = screen.getByRole("complementary", { name: "Issue sidebar" });
    expect(within(sidebar).getByRole("heading", { name: "Live support" })).toBeTruthy();
  });

  it("shows no staff-only tools", () => {
    renderView();
    expect(screen.queryByText("Manage issue")).toBeNull();
    expect(screen.queryByText("Student snapshot")).toBeNull();
    expect(screen.queryByText("Danger zone")).toBeNull();
    expect(screen.queryByText("status form")).toBeNull();
    expect(screen.queryByText("publish form")).toBeNull();
    expect(screen.queryByText("archive")).toBeNull();
    expect(screen.queryByRole("button", { name: "Copy for AI" })).toBeNull();
  });

  it("offers the follow-up composer only after a team reply", () => {
    renderView();
    expect(screen.getByRole("form", { name: "Follow-up" })).toBeTruthy();
  });

  it("asks the student to wait when the team has not replied yet", () => {
    renderView({ replies: [] });
    expect(screen.queryByRole("form", { name: "Follow-up" })).toBeNull();
    expect(screen.getByText(/Wait for the support team/)).toBeTruthy();
    expect(screen.getByText("No answer yet.")).toBeTruthy();
  });

  it("closes follow-ups on an archived request", () => {
    renderView({ issue: { ...issue, status: "ARCHIVED" } });
    expect(screen.queryByRole("form", { name: "Follow-up" })).toBeNull();
    expect(screen.getByText(/archived, so follow-up replies are closed/)).toBeTruthy();
  });

  it("confirms a fresh submission with a status banner", () => {
    renderView({ created: true });
    expect(screen.getByRole("status").textContent).toContain("Your issue has been submitted.");
  });
});
