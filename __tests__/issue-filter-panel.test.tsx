/**
 * The filter panel must follow the URL across client-side navigations.
 *
 * The search box is controlled and already resyncs; the advanced fields used
 * to be `defaultValue` (mount-time only), so chip removal, Reset, a tag
 * suggestion or back/forward left the selects showing stale values — and the
 * chips themselves hid inside the collapsed panel. These tests pin the fix:
 * fields adopt new defaults, the chips stay outside the collapsed second line,
 * and typing a keyword never wipes unsubmitted field edits.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}));

import { IssueFilterPanel } from "@/components/issues/issue-filter-panel";
import {
  DEFAULT_ISSUE_FILTERS,
  type IssueFilterDefaults,
} from "@/lib/issue-list-params";

const defaults = (overrides: Partial<IssueFilterDefaults> = {}): IssueFilterDefaults => ({
  ...DEFAULT_ISSUE_FILTERS,
  ...overrides,
});

const props = {
  statuses: ["OPEN", "SOLVED"] as const,
  courseSlugs: ["react-beginner"],
  batchNos: [7, 12],
  mentors: [{ id: "64b7f0c2c1a4e8f0a1b2c3d4", name: "Mentor A" }],
  showMentor: true,
};

const renderPanel = (overrides: Partial<IssueFilterDefaults> = {}) =>
  render(<IssueFilterPanel {...props} defaults={defaults(overrides)} />);

const statusSelect = () => screen.getByLabelText("Status") as HTMLSelectElement;
const courseSelect = () => screen.getByLabelText("Course") as HTMLSelectElement;
const sortSelect = () => screen.getByLabelText("Sort by") as HTMLSelectElement;
const advancedToggle = () =>
  screen.getByRole("button", { name: "Advanced filters" }) as HTMLButtonElement;

describe("IssueFilterPanel resync", () => {
  it("reflects an externally removed filter", () => {
    const view = renderPanel({ status: "OPEN", sort: "answer" });
    expect(statusSelect().value).toBe("OPEN");

    // Chip removal / Clear filters navigates client-side with the filter gone.
    view.rerender(
      <IssueFilterPanel {...props} defaults={defaults({ sort: "answer" })} />,
    );
    expect(statusSelect().value).toBe("");
  });

  it("keeps line two closed when a navigation adds an advanced filter", () => {
    const view = renderPanel({ sort: "answer" });
    expect(advancedToggle().getAttribute("aria-expanded")).toBe("false");

    // Clicking a course/tag suggestion adds a filter without a page reload.
    view.rerender(
      <IssueFilterPanel {...props} defaults={defaults({ courseSlug: "react-beginner", sort: "answer" })} />,
    );

    // The chip explains the filter; the form does not expand on its own.
    expect(advancedToggle().getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("link", { name: /Course: react-beginner/ })).toBeDefined();
    expect(courseSelect().value).toBe("react-beginner");
  });

  it("keeps line two closed for a keyword alone", () => {
    renderPanel({ q: "image", sort: "relevance" });

    expect(advancedToggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("does not wipe unsubmitted edits when only the keyword changes", () => {
    const view = renderPanel({ sort: "answer" });

    fireEvent.change(courseSelect(), { target: { value: "react-beginner" } });
    expect(courseSelect().value).toBe("react-beginner");

    // Typing in the search box navigates on `q` (and flips the sort default),
    // but the advanced fields were not part of that navigation.
    view.rerender(
      <IssueFilterPanel {...props} defaults={defaults({ q: "image", sort: "relevance" })} />,
    );

    expect(courseSelect().value).toBe("react-beginner");
    expect(sortSelect().value).toBe("relevance");
  });

  it("adopts a sort change from the URL", () => {
    const view = renderPanel({ sort: "answer" });

    view.rerender(
      <IssueFilterPanel {...props} defaults={defaults({ sort: "oldest" })} />,
    );

    expect(sortSelect().value).toBe("oldest");
  });
});

describe("IssueFilterPanel toolbar", () => {
  it("expands line two from the arrow and collapses it again", () => {
    renderPanel();

    expect(advancedToggle().getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(advancedToggle());
    expect(advancedToggle().getAttribute("aria-expanded")).toBe("true");
    fireEvent.click(advancedToggle());
    expect(advancedToggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("keeps the active-filter chips visible while line two is collapsed", () => {
    renderPanel({ status: "OPEN", sort: "answer" });

    expect(advancedToggle().getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByRole("link", { name: /Status: Open/ })).toBeTruthy();
  });

  it("offers Clear filters only when an advanced filter is active", () => {
    const view = renderPanel({ q: "image", sort: "relevance" });
    expect(screen.queryByRole("link", { name: "Clear filters" })).toBeNull();

    view.rerender(
      <IssueFilterPanel
        {...props}
        defaults={defaults({ q: "image", status: "OPEN", sort: "relevance" })}
      />,
    );

    expect(screen.getByRole("link", { name: "Clear filters" })).toBeTruthy();
  });

  it("clears the filters but keeps the keyword", () => {
    renderPanel({ q: "image", status: "OPEN", sort: "relevance" });

    const href = screen.getByRole("link", { name: "Clear filters" }).getAttribute("href");

    expect(href).toContain("q=image");
    expect(href).not.toContain("status=");
  });
});
