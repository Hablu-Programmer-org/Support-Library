import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  buildIssueCardStaff,
  IssueCard,
  ISSUE_CARD_MAX_TAGS,
} from "@/components/issues/issue-card";

const baseRow = {
  id: "issue-1",
  status: "OPEN" as const,
  caseRef: "000123",
  studentName: "Rahim Uddin",
  studentEmail: "rahim@test.com",
  awaitingStaff: true,
  lastStaffReplyAt: null,
};

const href = "/dashboard/issues/issue-1?returnTo=%2Fdashboard%2Fissues%3Fpage%3D2";

describe("buildIssueCardStaff", () => {
  it("returns nothing for a student, even when the row carries staff fields", () => {
    expect(
      buildIssueCardStaff(baseRow, { canManage: false, waitingIds: new Set(["issue-1"]) }),
    ).toBeUndefined();
  });

  it("labels an unanswered issue for staff", () => {
    expect(buildIssueCardStaff(baseRow, { canManage: true, waitingIds: new Set() })).toEqual({
      caseRef: "000123",
      studentName: "Rahim Uddin",
      studentEmail: "rahim@test.com",
      replyLabel: "No reply yet",
      waitingLive: false,
    });
  });

  it("says the student replied when staff answered before", () => {
    const staff = buildIssueCardStaff(
      { ...baseRow, lastStaffReplyAt: new Date("2026-11-01") },
      { canManage: true, waitingIds: new Set() },
    );
    expect(staff?.replyLabel).toBe("Student replied");
  });

  it("shows no reply label when nothing is awaited", () => {
    const staff = buildIssueCardStaff(
      { ...baseRow, awaitingStaff: false },
      { canManage: true, waitingIds: new Set() },
    );
    expect(staff?.replyLabel).toBeNull();
  });

  it("marks live-support waiting only for eligible statuses", () => {
    const waitingIds = new Set(["issue-1"]);
    expect(buildIssueCardStaff(baseRow, { canManage: true, waitingIds })?.waitingLive).toBe(true);
    expect(
      buildIssueCardStaff({ ...baseRow, status: "SOLVED" }, { canManage: true, waitingIds })
        ?.waitingLive,
    ).toBe(false);
  });

  it("falls back to a placeholder name", () => {
    const staff = buildIssueCardStaff(
      { ...baseRow, studentName: "" },
      { canManage: true, waitingIds: new Set() },
    );
    expect(staff?.studentName).toBe("Unknown student");
  });
});

describe("IssueCard", () => {
  const card = {
    href,
    title: "React image not rendering",
    question: "Image show hocche na in React component",
    status: "OPEN" as const,
    tags: ["react"],
    updatedAt: new Date("2026-11-03T10:00:00Z"),
  };

  it("links the title to the detail page, keeping returnTo", () => {
    render(<IssueCard {...card} />);
    const link = screen.getByRole("link", { name: "React image not rendering" });
    expect(link.getAttribute("href")).toBe(href);
  });

  it("keeps the h2 text to the title only (queue e2e reads it)", () => {
    render(<IssueCard {...card} staff={buildIssueCardStaff(baseRow, { canManage: true, waitingIds: new Set() })} />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("React image not rendering");
  });

  it("drops the preview when the question only repeats the title", () => {
    render(
      <IssueCard
        {...card}
        title="ai agent কানেকশন দিতে সমস্যা হচ্ছে"
        question="  AI agent কানেকশন দিতে সমস্যা হচ্ছে । "
      />,
    );
    expect(screen.getAllByText(/কানেকশন দিতে সমস্যা/)).toHaveLength(1);
  });

  it("keeps the preview when the question adds detail", () => {
    render(<IssueCard {...card} />);
    expect(screen.getByText("Image show hocche na in React component")).toBeTruthy();
  });

  it("shows no staff data for a student card", () => {
    render(<IssueCard {...card} />);
    expect(screen.queryByText("No reply yet")).toBeNull();
    expect(screen.queryByText("Student replied")).toBeNull();
    expect(screen.queryByText(/rahim/i)).toBeNull();
    expect(screen.queryByText("000123")).toBeNull();
  });

  it("shows the staff line and badges next to the heading", () => {
    render(
      <IssueCard
        {...card}
        staff={buildIssueCardStaff(baseRow, { canManage: true, waitingIds: new Set(["issue-1"]) })}
      />,
    );
    const titleRow = screen.getByRole("heading", { level: 2 }).parentElement!;
    expect(within(titleRow).getByText("No reply yet")).toBeTruthy();
    expect(within(titleRow).getByText("Waiting in live support")).toBeTruthy();
    expect(screen.getByText("000123")).toBeTruthy();
    expect(screen.getByText(/Rahim Uddin · rahim@test.com/)).toBeTruthy();
  });

  it("renders HTML in the title and question as plain text", () => {
    const { container } = render(
      <IssueCard
        {...card}
        title={'<img src=x onerror="alert(1)">'}
        question={"<script>alert('x')</script>"}
      />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText("<script>alert('x')</script>")).toBeTruthy();
  });

  it("collapses extra tags into a +N chip", () => {
    render(<IssueCard {...card} tags={["a", "b", "c", "d", "e"]} />);
    const tags = screen.getByRole("list", { name: "Tags" });
    expect(within(tags).getAllByRole("listitem")).toHaveLength(ISSUE_CARD_MAX_TAGS + 1);
    expect(within(tags).getByText("+2")).toBeTruthy();
  });

  it("omits the tag list when there are no tags", () => {
    render(<IssueCard {...card} tags={[]} />);
    expect(screen.queryByRole("list", { name: "Tags" })).toBeNull();
  });

  it("shows the Dhaka short date and skips an invalid one", () => {
    const { rerender } = render(<IssueCard {...card} />);
    expect(screen.getByText("3 Nov").getAttribute("datetime")).toBe("2026-11-03T10:00:00.000Z");
    rerender(<IssueCard {...card} updatedAt="not-a-date" />);
    expect(screen.queryByText("3 Nov")).toBeNull();
    expect(document.querySelector("time")).toBeNull();
  });

  it("does not prefix the date with 'Updated' (the refresh control owns that text)", () => {
    render(<IssueCard {...card} />);
    expect(screen.queryByText(/^Updated /)).toBeNull();
  });

  it("renders actions outside the link", () => {
    render(<IssueCard {...card} actions={<button type="button">Delete issue</button>} />);
    const link = screen.getByRole("link");
    expect(within(link).queryByRole("button")).toBeNull();
    expect(screen.getByRole("button", { name: "Delete issue" })).toBeTruthy();
  });

  it("shows course and batch when present", () => {
    render(<IssueCard {...card} courseSlug="web-dev" batchNo={4} />);
    expect(screen.getByText("web-dev · Batch 4")).toBeTruthy();
  });

  it("prefers the course name over the slug", () => {
    render(<IssueCard {...card} courseSlug="web-dev" courseName="Web Development" batchNo={4} />);
    expect(screen.getByText("Web Development · Batch 4")).toBeTruthy();
  });

  it("drops the badge on a solved card for library readers only", () => {
    const { rerender } = render(<IssueCard {...card} status="SOLVED" quietSolved />);
    expect(screen.queryByText("Solved")).toBeNull();

    rerender(<IssueCard {...card} status="OPEN" quietSolved />);
    expect(screen.getByText("Open")).toBeTruthy();

    rerender(<IssueCard {...card} status="SOLVED" />);
    expect(screen.getByText("Solved")).toBeTruthy();
  });

  it("labels the date with its prefix", () => {
    render(<IssueCard {...card} datePrefix="Answered" />);
    expect(screen.getByText(/^Answered/).querySelector("time")).toBeTruthy();
  });
});
