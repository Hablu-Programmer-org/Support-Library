import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MyIssuesFilter, myIssuesViewHref } from "@/components/issues/my-issues-filter";
import { groupMyIssues, parseMyIssuesView } from "@/lib/my-issues-view";

const counts = { all: 5, action: 1, active: 2, closed: 2 };

function tile(label: string) {
  return screen.getByRole("link", { name: new RegExp(`^${label}`) });
}

describe("myIssuesViewHref", () => {
  it("keeps one canonical URL for the default view", () => {
    expect(myIssuesViewHref("all")).toBe("/dashboard/my-issues");
  });

  it("adds the view for the other buckets", () => {
    expect(myIssuesViewHref("action")).toBe("/dashboard/my-issues?view=action");
    expect(myIssuesViewHref("active")).toBe("/dashboard/my-issues?view=active");
    expect(myIssuesViewHref("closed")).toBe("/dashboard/my-issues?view=closed");
  });

  it("round-trips through parseMyIssuesView", () => {
    for (const view of ["action", "active", "closed"] as const) {
      const query = new URL(myIssuesViewHref(view), "http://x").searchParams.get("view");
      expect(parseMyIssuesView(query ?? undefined)).toBe(view);
    }
  });
});

describe("MyIssuesFilter", () => {
  it("renders four tiles with their counts and links", () => {
    render(<MyIssuesFilter counts={counts} view="all" />);
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(tile("All issues")).toHaveTextContent("5");
    expect(tile("Needs your reply")).toHaveTextContent("1");
    expect(tile("In progress")).toHaveTextContent("2");
    expect(tile("Closed")).toHaveAttribute("href", "/dashboard/my-issues?view=closed");
  });

  it("marks only the current view with aria-current", () => {
    render(<MyIssuesFilter counts={counts} view="closed" />);
    const current = screen.getAllByRole("link").filter((l) => l.getAttribute("aria-current") === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveTextContent("Closed");
    expect(tile("Closed")).toHaveAttribute("data-tone", "selected");
  });

  it("highlights Needs your reply while something waits on the student", () => {
    render(<MyIssuesFilter counts={counts} view="all" />);
    expect(tile("Needs your reply")).toHaveAttribute("data-tone", "attention");
    expect(tile("In progress")).toHaveAttribute("data-tone", "default");
  });

  it("keeps Needs your reply neutral at zero", () => {
    render(<MyIssuesFilter counts={{ ...counts, action: 0 }} view="all" />);
    expect(tile("Needs your reply")).toHaveAttribute("data-tone", "default");
  });

  it("shows selected over attention when that tile is chosen", () => {
    render(<MyIssuesFilter counts={counts} view="action" />);
    expect(tile("Needs your reply")).toHaveAttribute("data-tone", "selected");
  });

  it("falls back to All for a hostile view param", () => {
    const view = parseMyIssuesView("<script>alert(1)</script>");
    render(<MyIssuesFilter counts={groupMyIssues([])} view={view} />);
    expect(tile("All issues")).toHaveAttribute("aria-current", "page");
    expect(tile("All issues")).toHaveTextContent("0");
  });
});
