import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import MyIssuesLoading from "@/app/dashboard/my-issues/loading";

describe("My issues loading skeleton", () => {
  it("is a busy status region with a screen-reader label", () => {
    render(<MyIssuesLoading />);
    const region = screen.getByRole("status");
    expect(region).toHaveAttribute("aria-busy", "true");
    expect(region).toHaveTextContent("Loading my issues");
  });

  it("mirrors the page: four count tiles and three issue rows", () => {
    render(<MyIssuesLoading />);
    expect(screen.getAllByTestId("my-issues-tile-skeleton")).toHaveLength(4);
    expect(screen.getAllByTestId("my-issues-row-skeleton")).toHaveLength(3);
  });

  it("shows no spinner or visible loading copy", () => {
    const { container } = render(<MyIssuesLoading />);
    expect(container.querySelector(".animate-spin")).toBeNull();
    expect(screen.queryByText(/Loading…|Loading\.\.\./)).toBeNull();
    // The only text is the sr-only label.
    expect(container.querySelector(".sr-only")?.textContent).toBe("Loading my issues");
  });

  it("stops pulsing for reduced-motion users", () => {
    const { container } = render(<MyIssuesLoading />);
    const blocks = container.querySelectorAll(".animate-pulse");
    expect(blocks.length).toBeGreaterThan(0);
    blocks.forEach((block) => expect(block).toHaveClass("motion-reduce:animate-none"));
  });
});
