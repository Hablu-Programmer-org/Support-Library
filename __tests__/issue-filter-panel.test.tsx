/**
 * The filter panel must follow the URL across client-side navigations.
 *
 * The search box is controlled and already resyncs; the advanced fields used
 * to be `defaultValue` (mount-time only), so chip removal, Reset, a tag
 * suggestion or back/forward left the selects showing stale values — and the
 * chips themselves hid inside the collapsed panel. These tests pin the fix:
 * fields adopt new defaults, a newly added advanced filter opens the panel,
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
const tagInput = () => screen.getByLabelText("Tag") as HTMLInputElement;
const advancedToggle = () =>
  screen.getByRole("button", { name: "Advanced filters" }) as HTMLButtonElement;

describe("IssueFilterPanel resync", () => {
  it("reflects an externally removed filter", () => {
    const view = renderPanel({ status: "OPEN", sort: "answer" });
    expect(statusSelect().value).toBe("OPEN");

    // Chip removal / Reset navigates client-side with the filter gone.
    view.rerender(
      <IssueFilterPanel {...props} defaults={defaults({ sort: "answer" })} />,
    );
    expect(statusSelect().value).toBe("");
  });

  it("opens the panel when a navigation adds an advanced filter", () => {
    const view = renderPanel({ sort: "answer" });
    expect(advancedToggle().getAttribute("aria-expanded")).toBe("false");

    // Clicking a tag suggestion adds `tag=video` without a page reload.
    view.rerender(
      <IssueFilterPanel {...props} defaults={defaults({ tag: "video", sort: "answer" })} />,
    );

    expect(advancedToggle().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("link", { name: /Tag: video/ })).toBeDefined();
    expect(tagInput().value).toBe("video");
  });

  it("keeps the panel closed for a keyword alone", () => {
    renderPanel({ q: "image", sort: "relevance" });

    expect(advancedToggle().getAttribute("aria-expanded")).toBe("false");
  });

  it("does not wipe unsubmitted edits when only the keyword changes", () => {
    const view = renderPanel({ sort: "answer" });

    fireEvent.change(tagInput(), { target: { value: "video" } });
    expect(tagInput().value).toBe("video");

    // Typing in the search box navigates on `q` (and flips the sort default),
    // but the advanced fields were not part of that navigation.
    view.rerender(
      <IssueFilterPanel {...props} defaults={defaults({ q: "image", sort: "relevance" })} />,
    );

    expect(tagInput().value).toBe("video");
    expect((screen.getByLabelText("Sort by") as HTMLSelectElement).value).toBe("relevance");
  });

  it("adopts a sort change from the URL", () => {
    const view = renderPanel({ sort: "answer" });

    view.rerender(
      <IssueFilterPanel {...props} defaults={defaults({ sort: "oldest" })} />,
    );

    expect((screen.getByLabelText("Sort by") as HTMLSelectElement).value).toBe("oldest");
  });
});
