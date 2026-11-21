import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  isLiveEligible,
  MyIssueCard,
  type MyIssueCardIssue,
  myIssueCta,
} from "@/components/issues/my-issue-card";
import { formatSupportRelative } from "@/lib/format-date";

const NOW = new Date("2026-11-22T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

function issue(overrides: Partial<MyIssueCardIssue> = {}): MyIssueCardIssue {
  return {
    id: "665f1c2ab3c4d5e6f7a8b9c0",
    title: "Prisma migration fails on deploy",
    status: "OPEN",
    caseRef: "#004213",
    courseSlug: "full-stack",
    batchNo: 4,
    moduleSlug: "module-18",
    uploads: [],
    createdAt: ago(3 * DAY),
    updatedAt: ago(2 * HOUR),
    lastStaffReplyAt: null,
    ...overrides,
  };
}

describe("myIssueCta", () => {
  it("asks for a reply first, even when the room is live and the team replied", () => {
    expect(myIssueCta({ status: "AWAITING_STUDENT", live: true, teamReplied: true })).toBe("Reply now");
  });

  it("offers live support before reading a reply", () => {
    expect(myIssueCta({ status: "OPEN", live: true, teamReplied: true })).toBe("Join live");
  });

  it("points at the reply when not live", () => {
    expect(myIssueCta({ status: "OPEN", live: false, teamReplied: true })).toBe("View reply");
    expect(myIssueCta({ status: "SOLVED", live: false, teamReplied: true })).toBe("View reply");
  });

  it("falls back to Open", () => {
    expect(myIssueCta({ status: "PENDING", live: false, teamReplied: false })).toBe("Open");
    expect(myIssueCta({ status: "ARCHIVED", live: false, teamReplied: false })).toBe("Open");
  });
});

describe("isLiveEligible", () => {
  it("needs an open room and an eligible status", () => {
    expect(isLiveEligible("OPEN", true)).toBe(true);
    expect(isLiveEligible("PENDING", true)).toBe(true);
    expect(isLiveEligible("FOLLOW_UP", true)).toBe(true);
    expect(isLiveEligible("OPEN", false)).toBe(false);
    expect(isLiveEligible("SOLVED", true)).toBe(false);
    expect(isLiveEligible("ARCHIVED", true)).toBe(false);
    expect(isLiveEligible("AWAITING_STUDENT", true)).toBe(false);
  });
});

describe("formatSupportRelative", () => {
  it("returns null for missing or broken dates", () => {
    expect(formatSupportRelative(null, NOW)).toBeNull();
    expect(formatSupportRelative(undefined, NOW)).toBeNull();
    expect(formatSupportRelative("not-a-date", NOW)).toBeNull();
    expect(formatSupportRelative(ago(HOUR), new Date("bad"))).toBeNull();
  });

  it("never shows a negative age for a future date", () => {
    expect(formatSupportRelative(new Date(NOW.getTime() + 5 * MIN), NOW)).toBe("just now");
  });

  it("uses minutes, hours and days up to a week", () => {
    expect(formatSupportRelative(ago(30_000), NOW)).toBe("just now");
    expect(formatSupportRelative(ago(MIN), NOW)).toBe("1m ago");
    expect(formatSupportRelative(ago(59 * MIN), NOW)).toBe("59m ago");
    expect(formatSupportRelative(ago(HOUR), NOW)).toBe("1h ago");
    expect(formatSupportRelative(ago(23 * HOUR + 59 * MIN), NOW)).toBe("23h ago");
    expect(formatSupportRelative(ago(DAY), NOW)).toBe("1d ago");
    expect(formatSupportRelative(ago(7 * DAY - MIN), NOW)).toBe("6d ago");
  });

  it("switches to the Dhaka calendar date from 7 days", () => {
    expect(formatSupportRelative(ago(7 * DAY), NOW)).toBe("15 Nov 2026");
    expect(formatSupportRelative("2026-10-12T08:47:00Z", NOW)).toBe("12 Oct 2026");
  });
});

describe("MyIssueCard", () => {
  it("renders exactly one link, to the issue", () => {
    render(<MyIssueCard issue={issue()} now={NOW} roomOpen={false} />);
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute("href", "/dashboard/issues/665f1c2ab3c4d5e6f7a8b9c0");
    expect(links[0]).toHaveTextContent("Prisma migration fails on deploy — Open");
  });

  it("marks a reply-needed issue as the action group with Reply now", () => {
    render(
      <MyIssueCard
        issue={issue({ status: "AWAITING_STUDENT", lastStaffReplyAt: ago(2 * HOUR) })}
        now={NOW}
        roomOpen
      />,
    );
    const card = screen.getByTestId("my-issue-card");
    expect(card).toHaveAttribute("data-group", "action");
    expect(screen.getByRole("link")).toHaveTextContent("— Reply now");
    expect(within(card).getByText("Team replied")).toBeInTheDocument();
    expect(within(card).queryByText("Live now")).toBeNull();
    expect(within(card).getByText("Replied 2h ago")).toBeInTheDocument();
  });

  it("shows Live now and Join live only while the room is open", () => {
    const { rerender } = render(<MyIssueCard issue={issue()} now={NOW} roomOpen />);
    expect(screen.getByText("Live now")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveTextContent("— Join live");

    rerender(<MyIssueCard issue={issue()} now={NOW} roomOpen={false} />);
    expect(screen.queryByText("Live now")).toBeNull();
    expect(screen.getByRole("link")).toHaveTextContent("— Open");
  });

  it("shows the update age when the team has not replied", () => {
    render(<MyIssueCard issue={issue()} now={NOW} roomOpen={false} />);
    expect(screen.getByText("Updated 2h ago")).toBeInTheDocument();
  });

  it("puts a closed issue in the closed group", () => {
    render(
      <MyIssueCard
        issue={issue({ status: "SOLVED", lastStaffReplyAt: ago(3 * DAY) })}
        now={NOW}
        roomOpen
      />,
    );
    expect(screen.getByTestId("my-issue-card")).toHaveAttribute("data-group", "closed");
    expect(screen.getByRole("link")).toHaveTextContent("— View reply");
  });

  it("copes with a missing case ref, no uploads and no dates", () => {
    render(
      <MyIssueCard
        issue={issue({
          caseRef: null,
          uploads: undefined as unknown as MyIssueCardIssue["uploads"],
          updatedAt: undefined,
          createdAt: undefined,
          courseSlug: null,
          batchNo: null,
          moduleSlug: null,
        })}
        now={NOW}
        roomOpen={false}
      />,
    );
    const card = screen.getByTestId("my-issue-card");
    expect(within(card).getByLabelText("No case reference")).toHaveTextContent("—");
    expect(within(card).queryByText(/files?$/)).toBeNull();
    expect(card.querySelector("time")).toBeNull();
  });

  it("counts attachments with the right plural", () => {
    const upload = { id: "u1" } as unknown as MyIssueCardIssue["uploads"][number];
    const { rerender } = render(
      <MyIssueCard issue={issue({ uploads: [upload] })} now={NOW} roomOpen={false} />,
    );
    expect(screen.getByText("1 file")).toBeInTheDocument();
    rerender(<MyIssueCard issue={issue({ uploads: [upload, upload] })} now={NOW} roomOpen={false} />);
    expect(screen.getByText("2 files")).toBeInTheDocument();
  });

  it("renders a hostile title as text, not markup", () => {
    render(
      <MyIssueCard issue={issue({ title: '<img src=x onerror="alert(1)">' })} now={NOW} roomOpen={false} />,
    );
    const link = screen.getByRole("link");
    expect(link.querySelector("img")).toBeNull();
    expect(link).toHaveTextContent('<img src=x onerror="alert(1)">');
  });

  it("joins course, batch and module into one label", () => {
    render(<MyIssueCard issue={issue()} now={NOW} roomOpen={false} />);
    expect(screen.getByText("full-stack · Batch 4 · module-18")).toBeInTheDocument();
  });
});
