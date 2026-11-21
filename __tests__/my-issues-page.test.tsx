import "@testing-library/jest-dom/vitest";

import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  listOwnIssues: vi.fn(),
  getOwnIssueActivitySnapshot: vi.fn(),
  currentShift: vi.fn(),
}));

vi.mock("@/lib/auth-guard", () => ({ requireSession: mocks.requireSession }));
vi.mock("@/lib/services/issues", () => ({ listOwnIssues: mocks.listOwnIssues }));
vi.mock("@/lib/services/issue-activity", () => ({
  getOwnIssueActivitySnapshot: mocks.getOwnIssueActivitySnapshot,
}));
vi.mock("@/lib/config/live-support", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/live-support")>()),
  currentShift: mocks.currentShift,
}));
vi.mock("@/components/issues/my-requests-refresh", () => ({
  MyRequestsRefresh: () => <span data-testid="auto-refresh" />,
}));

import MyIssuesPage from "@/app/dashboard/my-issues/page";

const STUDENT_ID = "665f1c2ab3c4d5e6f7a8b900";

function row(id: string, status: string, title: string) {
  return {
    id,
    title,
    status,
    caseRef: `#00${id.slice(-4)}`,
    courseSlug: null,
    batchNo: null,
    moduleSlug: null,
    uploads: [],
    createdAt: new Date(Date.now() - 3 * 3_600_000),
    updatedAt: new Date(Date.now() - 2 * 3_600_000),
    lastStaffReplyAt: null,
  };
}

const ISSUES = [
  row("665f1c2ab3c4d5e6f7a80001", "AWAITING_STUDENT", "Needs my reply"),
  row("665f1c2ab3c4d5e6f7a80002", "OPEN", "Still open"),
  row("665f1c2ab3c4d5e6f7a80003", "SOLVED", "All done"),
];

async function renderPage(view?: string | string[]) {
  const ui = await MyIssuesPage({ searchParams: Promise.resolve(view === undefined ? {} : { view }) });
  return render(ui);
}

function cardTitles() {
  return screen.queryAllByTestId("my-issue-card").map((card) => within(card).getByRole("heading").textContent);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSession.mockResolvedValue({ user: { id: STUDENT_ID, role: "STUDENT" } });
  mocks.getOwnIssueActivitySnapshot.mockResolvedValue({ revision: "r1" });
  mocks.currentShift.mockReturnValue("off");
  mocks.listOwnIssues.mockResolvedValue(ISSUES);
});

describe("My issues page", () => {
  it("lists only the session user's issues", async () => {
    await renderPage();
    expect(mocks.listOwnIssues).toHaveBeenCalledWith(STUDENT_ID);
    expect(cardTitles()).toHaveLength(3);
  });

  it("has no intro description or footer line", async () => {
    await renderPage();
    expect(screen.queryByText(/Only the issues you submitted/)).toBeNull();
    expect(screen.queryByText(/The team replies by email as well/)).toBeNull();
  });

  it("offers New issue in the header", async () => {
    await renderPage();
    expect(screen.getByRole("link", { name: "New issue" })).toHaveAttribute("href", "/dashboard/issues/new");
    expect(screen.getByTestId("auto-refresh")).toBeInTheDocument();
  });

  it("shows the live pill only while the room is open", async () => {
    const { unmount } = await renderPage();
    expect(screen.queryByText("Live support open")).toBeNull();
    unmount();

    mocks.currentShift.mockReturnValue("night");
    await renderPage();
    expect(screen.getByText("Live support open")).toBeInTheDocument();
  });

  it("filters by ?view and keeps the counts of the whole list", async () => {
    await renderPage("closed");
    // The heading carries the CTA for screen readers ("title — Open").
    expect(cardTitles()).toEqual(["All done — Open"]);
    const all = screen.getByRole("link", { name: /^All issues/ });
    expect(all).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: /^Closed/ })).toHaveAttribute("aria-current", "page");
  });

  it("shows everything for an unknown or hostile view", async () => {
    await renderPage("<script>alert(1)</script>");
    expect(cardTitles()).toHaveLength(3);
    expect(screen.getByRole("link", { name: /^All issues/ })).toHaveAttribute("aria-current", "page");
  });

  it("explains an empty filter and links back to all", async () => {
    mocks.listOwnIssues.mockResolvedValue([ISSUES[1]]);
    await renderPage("closed");
    expect(screen.getByText("No issues in this view.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show all issues" })).toHaveAttribute("href", "/dashboard/my-issues");
  });

  it("shows the empty state with a create CTA and no filter when there are no issues", async () => {
    mocks.listOwnIssues.mockResolvedValue([]);
    await renderPage();
    expect(screen.getByText("No issues yet")).toBeInTheDocument();
    expect(screen.getByText(/Open an issue and a mentor replies here/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Create an issue" })).toHaveAttribute("href", "/dashboard/issues/new");
    expect(screen.queryByRole("navigation", { name: "Filter my issues" })).toBeNull();
  });

  it("skips the auto-refresh probe for a staff account", async () => {
    mocks.requireSession.mockResolvedValue({ user: { id: STUDENT_ID, role: "ADMIN" } });
    await renderPage();
    expect(mocks.getOwnIssueActivitySnapshot).not.toHaveBeenCalled();
    expect(screen.queryByTestId("auto-refresh")).toBeNull();
    expect(cardTitles()).toHaveLength(3);
  });
});
