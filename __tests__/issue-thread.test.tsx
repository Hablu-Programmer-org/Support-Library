import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/replies", () => ({
  editReplyAction: vi.fn(async () => ({})),
  deleteReplyAction: vi.fn(async () => ({})),
}));

import { IssueThread } from "@/components/issues/issue-thread";
import { articleClass, authorInitial, replyAuthorLabel } from "@/components/issues/reply-item";
import type { SupportReplyListItem } from "@/lib/services/replies";

const reply = (id: string, extra: Partial<SupportReplyListItem> = {}): SupportReplyListItem => ({
  id,
  issueId: "issue-1",
  authorId: "staff-1",
  authorName: "Rahim",
  isStaffReply: true,
  body: `body ${id}`,
  uploads: [],
  createdAt: new Date("2026-11-21T06:03:00Z"),
  ...extra,
});

const three = [
  reply("r1", { body: "## Fix\n\nUse the `service_role` key" }),
  reply("r2", { authorId: "student-1", authorName: "Karim", isStaffReply: false }),
  reply("r3"),
];

type Props = Parameters<typeof IssueThread>[0];
const renderThread = (extra: Partial<Props> = {}) =>
  render(
    <IssueThread
      issueId="issue-1"
      status="SOLVED"
      replies={three}
      viewerId="staff-1"
      viewerRole="ADMIN"
      csrfToken="csrf"
      canEdit
      {...extra}
    />,
  );

describe("IssueThread", () => {
  it("lists every reply under one Responses heading with a count", () => {
    renderThread();
    expect(screen.queryByRole("heading", { name: "Solution" })).toBeNull();
    // The count chip sits outside the h2: its name stays exactly "Responses".
    const heading = screen.getByRole("heading", { name: "Responses" });
    expect(heading.textContent).toBe("Responses");
    expect(heading.parentElement?.textContent).toBe("Responses3");

    const list = screen.getByRole("list", { name: "Issue responses" });
    expect(within(list).getAllByRole("article")).toHaveLength(3);
  });

  it("marks the team's last answer as the Solution on a solved case", () => {
    renderThread();
    const [first, second, third] = screen.getAllByRole("article");
    expect(third.getAttribute("data-variant")).toBe("solution");
    expect(third.id).toBe("reply-r3");
    expect(within(third).getByText("Solution")).toBeTruthy();
    expect(first.getAttribute("data-variant")).toBe("response");
    expect(first.querySelector("code")?.textContent).toBe("service_role");
    expect(second.getAttribute("data-variant")).toBe("response");
    expect(within(second).queryByText("Solution")).toBeNull();
  });

  it("marks no Solution while the case is not solved", () => {
    renderThread({ status: "OPEN" });
    expect(screen.getAllByRole("article").every((a) => a.getAttribute("data-variant") === "response")).toBe(true);
    expect(screen.queryByText("Solution")).toBeNull();
  });

  it("shows a plain empty state without filler copy", () => {
    renderThread({ replies: [] });
    expect(screen.getByRole("heading", { name: "Responses" }).parentElement?.textContent).toBe("Responses");
    expect(screen.getByText("No answer yet.")).toBeTruthy();
    expect(screen.queryByText(/replies by email/)).toBeNull();
  });

  it("signs staff replies with the staff member's name and a Staff badge", () => {
    renderThread();
    const [first] = screen.getAllByRole("article");
    expect(within(first).getByText("Rahim")).toBeTruthy();
    expect(within(first).getByText("Staff")).toBeTruthy();
  });

  it("staff (admin) get edit and delete controls", () => {
    renderThread();
    expect(screen.getAllByRole("button", { name: "Delete" }).length).toBe(3);
  });

  it("public view shows no edit or delete control and hides student names", () => {
    renderThread({ canEdit: false, viewerId: "someone", viewerRole: "STUDENT" });
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Edit" })).toBeNull();
    expect(screen.queryByText("Karim")).toBeNull();
    expect(screen.getByText("Student")).toBeTruthy();
  });
});

describe("reply card helpers", () => {
  it("gives the solution an emerald accent and keeps responses neutral", () => {
    expect(articleClass("solution", true)).toContain("border-l-emerald-500");
    expect(articleClass("response", true)).not.toContain("emerald");
    expect(articleClass("response", false)).not.toBe(articleClass("response", true));
  });

  it("builds an avatar initial and survives an empty name", () => {
    expect(authorInitial("rahim")).toBe("R");
    expect(authorInitial("  ")).toBe("?");
  });
});

describe("replyAuthorLabel", () => {
  it("uses the staff member's name, and plain Staff when there is none", () => {
    expect(replyAuthorLabel({ isStaffReply: true, authorName: "Rahim" })).toBe("Rahim");
    expect(replyAuthorLabel({ isStaffReply: true, authorName: "  " })).toBe("Staff");
    expect(replyAuthorLabel({ isStaffReply: true })).toBe("Staff");
  });

  it("lets an explicit label win (public 'Student', owner 'You')", () => {
    expect(replyAuthorLabel({ isStaffReply: false, authorName: "Karim" }, "Student")).toBe("Student");
    expect(replyAuthorLabel({ isStaffReply: false }, "You")).toBe("You");
  });
});
