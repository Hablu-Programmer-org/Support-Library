/**
 * Owner feedback on the search section: a stuck bar must not show cards behind
 * it, the result summary must not ride along over the list, the brand gradient
 * is kept to the hero title and the search focus ring, and the loading page
 * has the new shape.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}));

import IssuesLoading from "@/app/dashboard/issues/loading";
import { IssueFilterPanel } from "@/components/issues/issue-filter-panel";
import { IssueListPagination } from "@/components/issues/issue-list-states";
import { DEFAULT_ISSUE_FILTERS, type IssueFilterDefaults } from "@/lib/issue-list-params";

const renderPanel = (overrides: Partial<IssueFilterDefaults> = {}, floating = true) =>
  render(
    <IssueFilterPanel
      batchNos={[]}
      courseSlugs={[]}
      defaults={{ ...DEFAULT_ISSUE_FILTERS, ...overrides }}
      floating={floating}
      mentors={[]}
      statuses={["OPEN", "SOLVED"]}
      summary="Total 303 issues"
    />,
  );

const gradient = /bg-linear-|from-violet|to-violet/;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("summary row", () => {
  it("sits after the sticky form, not inside it", () => {
    const { container } = renderPanel({ status: "OPEN" });
    const form = container.querySelector("form")!;
    const summary = screen.getByTestId("issue-list-summary");
    expect(form.contains(summary)).toBe(false);
    expect(form.nextElementSibling).toBe(summary);
    expect(within(summary).getByText("Total 303 issues")).toBeTruthy();
    expect(within(summary).getByRole("link", { name: "Clear filters" })).toBeTruthy();
  });

  it("is plain text, not a floating pill", () => {
    renderPanel();
    const summary = screen.getByTestId("issue-list-summary");
    expect(summary.className).not.toContain("backdrop-blur");
    expect(summary.className).not.toContain("rounded-full");
  });
});

describe("stuck strip", () => {
  const mockTop = (form: HTMLElement, top: number) =>
    vi.spyOn(form, "getBoundingClientRect").mockReturnValue({ top } as DOMRect);

  async function scroll() {
    await act(async () => {
      fireEvent.scroll(window);
      await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));
    });
  }

  it("turns solid once the floating bar reaches the header", async () => {
    const { container } = renderPanel();
    const form = container.querySelector("form")!;

    mockTop(form, 400);
    await scroll();
    expect(form.dataset.stuck).toBeUndefined();
    expect(form.className).not.toContain("before:bg-white/60");

    mockTop(form, 64);
    await scroll();
    expect(form.dataset.stuck).toBe("true");
    expect(form.className).toContain("before:bg-white/60");
    expect(form.className).toContain("dark:before:bg-slate-950/40");

    mockTop(form, 300);
    await scroll();
    expect(form.dataset.stuck).toBeUndefined();
  });

  it("leaves the staff bar alone (it is always glass)", async () => {
    const { container } = renderPanel({}, false);
    const form = container.querySelector("form")!;
    mockTop(form, 64);
    await scroll();
    expect(form.dataset.stuck).toBeUndefined();
    expect(form.className).toContain("before:bg-white/60");
  });

  it("stops listening when the panel unmounts", () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderPanel();
    unmount();
    expect(remove.mock.calls.some(([type]) => type === "scroll")).toBe(true);
  });
});

describe("gradient kept to the hero title and the focus ring", () => {
  it("uses solid or tinted colours for the active chip, Filters, badge and Filter", () => {
    renderPanel({ status: "SOLVED" });
    const toggle = screen.getByRole("button", { name: "Advanced filters" });
    fireEvent.click(toggle);
    const activeChip = within(screen.getByRole("navigation", { name: "Filter by status" }))
      .getByRole("link", { name: "Solved" });
    expect(activeChip.className).not.toMatch(gradient);
    expect(toggle.className).not.toMatch(gradient);
    expect(screen.getByTestId("active-filter-count").className).not.toMatch(gradient);
    expect(screen.getByRole("button", { name: "Filter" }).className).not.toMatch(gradient);
  });

  it("uses a solid current page in the pager", () => {
    render(<IssueListPagination hrefFor={(p) => `/x?page=${p}`} page={2} total={60} totalPages={3} />);
    const current = screen.getByText("2", { selector: '[aria-current="page"]' });
    expect(current.className).not.toMatch(gradient);
  });
});

describe("loading page", () => {
  it("shows the hero with its search card, then six cards", () => {
    const { container } = render(<IssuesLoading />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(screen.getByTestId("issues-hero-skeleton")).toBeTruthy();
    expect(screen.getAllByTestId("issue-card-skeleton")).toHaveLength(6);
    expect(screen.queryByText(/loading/i)).toBeNull();
  });
});
