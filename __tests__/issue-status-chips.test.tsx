import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}));

import { IssueFilterPanel } from "@/components/issues/issue-filter-panel";
import { IssueStatusChips } from "@/components/issues/issue-status-chips";
import { DEFAULT_ISSUE_FILTERS, type IssueFilterDefaults } from "@/lib/issue-list-params";

const defaults = (overrides: Partial<IssueFilterDefaults> = {}): IssueFilterDefaults => ({
  ...DEFAULT_ISSUE_FILTERS,
  ...overrides,
});

const chipNav = () => screen.getByRole("navigation", { name: "Filter by status" });
const chip = (name: string) => within(chipNav()).getByRole("link", { name });
const params = (href: string | null) => new URL(href ?? "", "http://x").searchParams;

describe("IssueStatusChips", () => {
  it("lists All + four statuses for students, without Archived", () => {
    render(<IssueStatusChips defaultSort="newest" defaults={defaults()} />);
    const names = within(chipNav()).getAllByRole("link").map((link) => link.textContent);
    expect(names).toEqual(["All", "Open", "Solved", "Pending", "Follow-up"]);
  });

  it("adds Archived for staff", () => {
    render(<IssueStatusChips defaultSort="answer" defaults={defaults()} staff />);
    expect(chip("Archived")).toBeTruthy();
  });

  it("keeps the keyword and other filters, and restarts at page 1", () => {
    render(
      <IssueStatusChips
        defaultSort="relevance"
        defaults={defaults({ q: "pip", courseSlug: "react-beginner", sort: "relevance" })}
      />,
    );
    const solved = params(chip("Solved").getAttribute("href"));
    expect(solved.get("status")).toBe("SOLVED");
    expect(solved.get("q")).toBe("pip");
    expect(solved.get("courseSlug")).toBe("react-beginner");
    expect(solved.get("page")).toBeNull();
  });

  it("marks the active status and lets All remove it", () => {
    render(<IssueStatusChips defaultSort="newest" defaults={defaults({ status: "OPEN" })} />);
    expect(chip("Open").getAttribute("aria-current")).toBe("true");
    expect(chip("All").getAttribute("aria-current")).toBeNull();
    expect(params(chip("All").getAttribute("href")).get("status")).toBeNull();
  });

  it("falls back to All for a status it does not offer", () => {
    render(<IssueStatusChips defaultSort="newest" defaults={defaults({ status: "ARCHIVED" })} />);
    expect(chip("All").getAttribute("aria-current")).toBe("true");
  });
});

describe("IssueFilterPanel with chips", () => {
  it("still posts a single status field", () => {
    const { container } = render(
      <IssueFilterPanel
        batchNos={[]}
        courseSlugs={[]}
        defaults={defaults({ status: "SOLVED" })}
        mentors={[]}
        statuses={["OPEN", "SOLVED"]}
      />,
    );
    expect(container.querySelectorAll('[name="status"]')).toHaveLength(1);
    expect(new FormData(container.querySelector("form")!).getAll("status")).toEqual(["SOLVED"]);
    expect(chip("Solved").getAttribute("aria-current")).toBe("true");
  });
});
