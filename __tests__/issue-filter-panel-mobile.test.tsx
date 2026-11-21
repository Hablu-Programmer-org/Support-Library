/**
 * The command-bar toolbar: the search bar carries the Filters button; status,
 * sort and the rest live in one drawer. Every control is rendered once and
 * stays in the form while the drawer is closed, so Enter or a later submit
 * never drops a filter and no `name` is posted twice.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn(), back: vi.fn() }),
}));

import { IssueFilterPanel } from "@/components/issues/issue-filter-panel";
import { IssueSearchField } from "@/components/issues/issue-search-field";
import { DEFAULT_ISSUE_FILTERS, type IssueFilterDefaults } from "@/lib/issue-list-params";

const renderPanel = (
  overrides: Partial<IssueFilterDefaults> = {},
  { floating = false, showMentor = false } = {},
) =>
  render(
    <IssueFilterPanel
      batchNos={[7]}
      courseSlugs={["react-beginner"]}
      defaults={{ ...DEFAULT_ISSUE_FILTERS, ...overrides }}
      floating={floating}
      mentors={[{ id: "64b7f0c2c1a4e8f0a1b2c3d4", name: "Mentor A" }]}
      showMentor={showMentor}
      statuses={["OPEN", "SOLVED"]}
    />,
  );

const toggle = () => screen.getByRole("button", { name: "Advanced filters" });
const drawer = () => document.getElementById("issue-advanced-filters")!;
/** Closed = collapsed, out of the tab order and the accessibility tree. */
const isClosed = (el: HTMLElement) =>
  el.hasAttribute("inert") && el.dataset.state === "closed" && el.className.includes("invisible");

describe("IssueFilterPanel command bar", () => {
  it("renders each control exactly once", () => {
    const { container } = renderPanel({}, { showMentor: true });
    for (const name of ["q", "status", "sort", "courseSlug", "batchNo", "mentorId", "from", "to"]) {
      expect(container.querySelectorAll(`[name="${name}"]`)).toHaveLength(1);
    }
    expect(screen.getAllByRole("button", { name: "Advanced filters" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Filter" })).toHaveLength(1);
  });

  it("puts the Filters button inside the search bar", () => {
    const { container } = renderPanel();
    const bar = container.querySelector('input[name="q"]')!.parentElement!;
    expect(bar.contains(toggle())).toBe(true);
  });

  it("keeps status and sort in the form while the drawer is closed", () => {
    const { container } = renderPanel({ status: "OPEN", sort: "oldest" });
    expect(isClosed(drawer())).toBe(true);
    const data = new FormData(container.querySelector("form")!);
    expect(data.get("status")).toBe("OPEN");
    expect(data.get("sort")).toBe("oldest");
  });

  it("opens and closes the drawer from the one toggle", () => {
    renderPanel();
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle());
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(isClosed(drawer())).toBe(false);
    expect(drawer().hasAttribute("inert")).toBe(false);
    expect(drawer().dataset.state).toBe("open");
    expect(drawer().contains(screen.getByLabelText("Status"))).toBe(true);
    expect(drawer().contains(screen.getByRole("button", { name: "Filter" }))).toBe(true);
    fireEvent.click(toggle());
    expect(isClosed(drawer())).toBe(true);
  });

  it("shows five selects in the staff drawer (shell e2e counts them)", () => {
    const { container } = renderPanel({}, { showMentor: true });
    expect(drawer().querySelectorAll("select[name]")).toHaveLength(5);
    expect(container.querySelectorAll("select[name]")).toHaveLength(5);
  });

  it("counts active filters on the toggle", () => {
    renderPanel({ status: "OPEN", tag: "n8n", courseSlug: "react-beginner" });
    expect(screen.getByTestId("active-filter-count").textContent).toBe("3");
  });

  it("does not count the keyword or sort", () => {
    renderPanel({ q: "pip error", sort: "oldest" });
    expect(screen.queryByTestId("active-filter-count")).toBeNull();
  });

  it("keeps every drawer field in the submitted form while closed", () => {
    const { container } = renderPanel(
      { status: "OPEN", courseSlug: "react-beginner", batchNo: "7", from: "2026-01-01", to: "2026-02-01" },
      { showMentor: true },
    );
    expect(isClosed(drawer())).toBe(true);
    const data = new FormData(container.querySelector("form")!);
    expect(data.get("courseSlug")).toBe("react-beginner");
    expect(data.get("batchNo")).toBe("7");
    expect(data.get("from")).toBe("2026-01-01");
    expect(data.get("to")).toBe("2026-02-01");
  });

  it("groups the dates and bounds them by each other", () => {
    renderPanel({ from: "2026-01-01", to: "2026-02-01" });
    const from = screen.getByLabelText("From date") as HTMLInputElement;
    const to = screen.getByLabelText("To date") as HTMLInputElement;
    expect(from.max).toBe("2026-02-01");
    expect(to.min).toBe("2026-01-01");
    expect(from.closest("fieldset")?.querySelector("legend")?.textContent).toBe("Date range");
  });

  it("offers Reset in the drawer only when a filter is active", () => {
    const { unmount } = renderPanel();
    expect(screen.queryByRole("link", { name: "Reset" })).toBeNull();
    unmount();
    renderPanel({ status: "OPEN", q: "pip" });
    const reset = screen.getByRole("link", { name: "Reset" }).getAttribute("href") ?? "";
    expect(reset).toContain("q=pip");
    expect(reset).not.toContain("status=");
  });

  it("pulls the floating card into the hero only when asked", () => {
    const { container, unmount } = renderPanel({}, { floating: true });
    expect(container.querySelector("form")!.className).toContain("-mt-[160px]");
    unmount();
    const { container: plain } = renderPanel();
    expect(plain.querySelector("form")!.className).not.toContain("-mt-[160px]");
  });
});

describe("IssueSearchField '/' shortcut", () => {
  const renderField = () =>
    render(
      <>
        <input aria-label="Other field" />
        <textarea aria-label="Notes" />
        <IssueSearchField defaults={{ ...DEFAULT_ISSUE_FILTERS }} defaultSort="newest" />
      </>,
    );
  const search = () => screen.getByLabelText("Search issues");

  it("focuses the search box from the page", () => {
    renderField();
    fireEvent.keyDown(document.body, { key: "/" });
    expect(document.activeElement).toBe(search());
  });

  it("never steals a slash typed into another field", () => {
    renderField();
    const other = screen.getByLabelText("Other field");
    other.focus();
    fireEvent.keyDown(other, { key: "/" });
    expect(document.activeElement).toBe(other);
    const notes = screen.getByLabelText("Notes");
    notes.focus();
    fireEvent.keyDown(notes, { key: "/" });
    expect(document.activeElement).toBe(notes);
  });

  it("ignores modified slashes and IME composition", () => {
    renderField();
    fireEvent.keyDown(document.body, { key: "/", ctrlKey: true });
    fireEvent.keyDown(document.body, { key: "/", metaKey: true });
    fireEvent.keyDown(document.body, { key: "/", isComposing: true });
    expect(document.activeElement).not.toBe(search());
  });

  it("shows the shortcut hint only while the box is empty", () => {
    renderField();
    expect(screen.getByTestId("search-shortcut-hint")).toBeTruthy();
    fireEvent.change(search(), { target: { value: "pip" } });
    expect(screen.queryByTestId("search-shortcut-hint")).toBeNull();
    expect(screen.getByRole("button", { name: "Clear search" })).toBeTruthy();
  });
});
