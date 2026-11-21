import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  IssueListPagination,
  NoIssuesState,
  NoResultsState,
} from "@/components/issues/issue-list-states";
import { buildPageList } from "@/lib/pagination";

describe("buildPageList", () => {
  it("lists every page when there are few", () => {
    expect(buildPageList(1, 3)).toEqual([1, 2, 3]);
    expect(buildPageList(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("puts gaps around the middle", () => {
    expect(buildPageList(5, 12)).toEqual([1, "gap", 4, 5, 6, "gap", 12]);
  });

  it("handles the start and the end", () => {
    expect(buildPageList(1, 12)).toEqual([1, 2, "gap", 12]);
    expect(buildPageList(12, 12)).toEqual([1, "gap", 11, 12]);
  });

  it("fills a one-page hole instead of a gap", () => {
    expect(buildPageList(4, 12)).toEqual([1, 2, 3, 4, 5, "gap", 12]);
  });

  it("returns one page for a single-page list", () => {
    expect(buildPageList(1, 1)).toEqual([1]);
  });

  it("degrades bad input to something safe", () => {
    // NaN/negative clamp to page 1, too large clamps to the last page; with
    // four pages every hole is a single page, so all four are listed.
    expect(buildPageList(Number.NaN, 8)).toEqual([1, 2, "gap", 8]);
    expect(buildPageList(99, 8)).toEqual([1, "gap", 7, 8]);
    expect(buildPageList(-5, 8)).toEqual([1, 2, "gap", 8]);
    expect(buildPageList(Number.NaN, 4)).toEqual([1, 2, 3, 4]);
    expect(buildPageList(1, Number.NaN)).toEqual([1]);
    expect(buildPageList(1, 0)).toEqual([1]);
    expect(buildPageList(2.7, 6.9)).toEqual([1, 2, 3, "gap", 6]);
  });
});

describe("IssueListPagination", () => {
  const hrefFor = (page: number) => `/dashboard/issues?page=${page}`;

  it("keeps the exact summary text e2e asserts", () => {
    render(<IssueListPagination hrefFor={hrefFor} page={2} total={25} totalPages={2} />);
    expect(screen.getByText("Page 2 of 2 · Total 25").tagName).toBe("SPAN");
  });

  it("hides the pager for a single page", () => {
    render(<IssueListPagination hrefFor={hrefFor} page={1} total={4} totalPages={1} />);
    expect(screen.getByText("Page 1 of 1 · Total 4")).toBeTruthy();
    expect(screen.queryByRole("navigation", { name: "Pagination" })).toBeNull();
  });

  it("links Previous, Next and numbers to the right pages", () => {
    render(<IssueListPagination hrefFor={hrefFor} page={5} total={240} totalPages={12} />);
    const nav = screen.getByRole("navigation", { name: "Pagination" });
    expect(within(nav).getByRole("link", { name: "Previous" }).getAttribute("href")).toBe(hrefFor(4));
    expect(within(nav).getByRole("link", { name: "Next" }).getAttribute("href")).toBe(hrefFor(6));
    expect(within(nav).getByRole("link", { name: "Page 12" }).getAttribute("href")).toBe(hrefFor(12));
    expect(within(nav).queryByRole("link", { name: "Page 2" })).toBeNull();
  });

  it("marks the current page and does not link it", () => {
    render(<IssueListPagination hrefFor={hrefFor} page={5} total={240} totalPages={12} />);
    const current = screen.getByText("5", { selector: '[aria-current="page"]' });
    expect(current.tagName).toBe("SPAN");
    expect(screen.queryByRole("link", { name: "Page 5" })).toBeNull();
  });

  it("drops Previous on the first page and Next on the last", () => {
    const { rerender } = render(
      <IssueListPagination hrefFor={hrefFor} page={1} total={40} totalPages={2} />,
    );
    expect(screen.queryByRole("link", { name: "Previous" })).toBeNull();
    expect(screen.getByRole("link", { name: "Next" })).toBeTruthy();
    rerender(<IssueListPagination hrefFor={hrefFor} page={2} total={40} totalPages={2} />);
    expect(screen.getByRole("link", { name: "Previous" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Next" })).toBeNull();
  });
});

describe("empty states", () => {
  it("offers Clear search and tag links for a keyword with no match", () => {
    render(
      <NoResultsState
        clearHref="/dashboard/issues"
        query="pip error"
        tags={[{ tag: "python", href: "/dashboard/issues?tag=python" }]}
      />,
    );
    expect(screen.getByText("No results for “pip error”.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Clear search" }).getAttribute("href")).toBe("/dashboard/issues");
    expect(screen.getByRole("link", { name: "#python" }).getAttribute("href")).toBe("/dashboard/issues?tag=python");
  });

  it("renders a hostile query as text", () => {
    const { container } = render(
      <NoResultsState clearHref="/dashboard/issues" query={'<img src=x onerror="alert(1)">'} tags={[]} />,
    );
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("list", { name: "Browse a tag" })).toBeNull();
  });

  it("caps tag suggestions at eight", () => {
    const tags = Array.from({ length: 12 }, (_, i) => ({ tag: `t${i}`, href: `/x?tag=t${i}` }));
    render(<NoResultsState clearHref="/dashboard/issues" query="x" tags={tags} />);
    expect(within(screen.getByRole("list", { name: "Browse a tag" })).getAllByRole("link")).toHaveLength(8);
  });

  it("keeps the No issues found copy", () => {
    render(<NoIssuesState />);
    expect(screen.getByText("No issues found.")).toBeTruthy();
  });
});
