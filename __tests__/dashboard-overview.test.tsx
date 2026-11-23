import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LiveSupportJoinQueue } from "@/components/live-support/join-queue";
import type { LiveSupportQueueEntry } from "@/lib/services/live-support-joins";
import { toUnresolvedBreakdown } from "@/lib/status-breakdown";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  isN8nAdmin: vi.fn(),
  getDashboardStats: vi.fn(),
  getUnresolvedStatusBreakdown: vi.fn(),
  getTopTags: vi.fn(),
  listLiveSupportQueue: vi.fn(),
  listStudentRequestsAwaitingStaff: vi.fn(),
  countStudentRequestsAwaitingStaff: vi.fn(),
  countPendingN8nRequests: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth-guard", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/n8n-request-policy", () => ({ isN8nAdmin: mocks.isN8nAdmin }));
vi.mock("@/lib/services/analytics", () => ({
  getDashboardStats: mocks.getDashboardStats,
  getUnresolvedStatusBreakdown: mocks.getUnresolvedStatusBreakdown,
  getTopTags: mocks.getTopTags,
}));
vi.mock("@/lib/services/issues", () => ({
  listStudentRequestsAwaitingStaff: mocks.listStudentRequestsAwaitingStaff,
  countStudentRequestsAwaitingStaff: mocks.countStudentRequestsAwaitingStaff,
}));
vi.mock("@/lib/services/live-support-joins", () => ({
  listLiveSupportQueue: mocks.listLiveSupportQueue,
  countStillWaiting: (entries: Array<{ issueStatus: string | null }>) =>
    entries.filter((entry) => entry.issueStatus === "PENDING").length,
}));
vi.mock("@/lib/services/n8n-requests", () => ({
  countPendingN8nRequests: mocks.countPendingN8nRequests,
}));

import DashboardPage from "@/app/dashboard/(overview)/page";

const entry = (i: number, overrides: Partial<LiveSupportQueueEntry> = {}): LiveSupportQueueEntry =>
  ({
    id: `j${i}`,
    joinedAt: new Date("2026-11-24T14:00:00.000Z"),
    shift: "night",
    caseRef: String(100 + i).padStart(6, "0"),
    issueId: `issue${i}`,
    issueTitle: `Room request ${i}`,
    issueStatus: "PENDING",
    issueDeleted: false,
    studentName: `Student ${i}`,
    studentEmail: `s${i}@example.com`,
    ...overrides,
  }) as LiveSupportQueueEntry;

describe("toUnresolvedBreakdown", () => {
  it("lists every unresolved status in order, zero-filled, ignoring others", () => {
    expect(
      toUnresolvedBreakdown([
        { _id: "PENDING", count: 2 },
        { _id: "SOLVED", count: 9 },
        { _id: "FOLLOW_UP", count: 1 },
        { _id: null, count: 4 },
      ]),
    ).toEqual([
      { status: "OPEN", count: 0 },
      { status: "PENDING", count: 2 },
      { status: "AWAITING_STUDENT", count: 0 },
      { status: "FOLLOW_UP", count: 1 },
    ]);
  });
});

describe("LiveSupportJoinQueue compact", () => {
  it("shows a one-line empty state", () => {
    render(<LiveSupportJoinQueue dayKey="2026-11-24" entries={[]} variant="compact" />);
    expect(screen.getByRole("region", { name: "Waiting today" })).toHaveTextContent(
      "No one has joined the room today.",
    );
  });

  it("caps at five rows, hides emails and links to the full queue", () => {
    const entries = Array.from({ length: 7 }, (_, i) => entry(i));
    render(<LiveSupportJoinQueue dayKey="2026-11-24" entries={entries} variant="compact" />);

    const region = screen.getByRole("region", { name: "Waiting today" });
    expect(within(region).getAllByRole("listitem")).toHaveLength(5);
    expect(region).not.toHaveTextContent("s0@example.com");
    expect(within(region).getByRole("link", { name: "2 more today →" })).toHaveAttribute(
      "href",
      "/dashboard/live-support",
    );
  });
});

describe("/dashboard overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isN8nAdmin.mockResolvedValue(true);
    mocks.getDashboardStats.mockResolvedValue({
      totalIssues: 337,
      unresolvedIssues: 2,
      staffCount: 3,
      weeklyIssues: 47,
    });
    mocks.getUnresolvedStatusBreakdown.mockResolvedValue(
      toUnresolvedBreakdown([{ _id: "PENDING", count: 2 }]),
    );
    mocks.getTopTags.mockResolvedValue([
      { tag: "n8n", count: 6 },
      { tag: "zoom", count: 1 },
    ]);
    mocks.listLiveSupportQueue.mockResolvedValue([entry(1), entry(2, { issueStatus: "SOLVED" })]);
    mocks.listStudentRequestsAwaitingStaff.mockResolvedValue([
      {
        id: "a1",
        caseRef: "000123",
        title: "Leaderboard get hang",
        status: "PENDING",
        createdAt: new Date("2026-10-24T03:47:00.000Z"),
      },
    ]);
    mocks.countStudentRequestsAwaitingStaff.mockResolvedValue(3);
    mocks.countPendingN8nRequests.mockResolvedValue(1);
  });

  it("sends a student to the issue list", async () => {
    mocks.requireSession.mockResolvedValue({ user: { id: "u", role: "STUDENT" } });
    await expect(DashboardPage()).rejects.toThrow("REDIRECT:/dashboard/issues");
  });

  it("leads with actionable numbers and the needs-a-mentor queue", async () => {
    mocks.requireSession.mockResolvedValue({ user: { id: "u", role: "ADMIN", email: "a@x.io" } });
    render(await DashboardPage());

    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Waiting now").closest("a")).toHaveTextContent("1");
    expect(screen.getByText("Needs a mentor", { selector: "p" }).closest("a")).toHaveTextContent("3");
    expect(screen.getByText("Of 337 total")).toBeInTheDocument();

    const queue = screen.getByRole("region", { name: "Needs a mentor" });
    expect(queue).toHaveTextContent("#000123");
    expect(queue).toHaveTextContent("Showing the oldest 1 of 3.");

    expect(screen.getByRole("link", { name: "Pending: 2 issues" })).toHaveAttribute(
      "href",
      "/dashboard/issues?status=PENDING",
    );
    expect(screen.getByRole("link", { name: "Open: 0 issues" })).toBeInTheDocument();

    const tags = screen.getByRole("region", { name: "Top tags" });
    expect(tags).toHaveTextContent("n8n");
    expect(tags).not.toHaveTextContent("zoom");

    expect(screen.getByRole("region", { name: "Access requests" })).toBeInTheDocument();
    // Someone is waiting, so the room link becomes the primary action.
    expect(screen.getByRole("link", { name: "Open live support" }).className).toContain("bg-primary");
  });

  it("hides the access queue from a mentor", async () => {
    mocks.requireSession.mockResolvedValue({ user: { id: "u", role: "MENTOR", email: "m@x.io" } });
    render(await DashboardPage());

    expect(screen.queryByRole("region", { name: "Access requests" })).not.toBeInTheDocument();
    expect(mocks.countPendingN8nRequests).not.toHaveBeenCalled();
  });
});
