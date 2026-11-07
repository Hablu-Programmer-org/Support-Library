/**
 * The timeout recovery notice: a slow search degrades to a message with a way
 * out, never to a blank list or an error page.
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SearchTimeoutNotice } from "@/components/issues/search-timeout-notice";

describe("SearchTimeoutNotice", () => {
  it("states the problem and offers a clear-search action", () => {
    render(<SearchTimeoutNotice href="/dashboard/issues?status=OPEN" />);

    expect(screen.getByText("Search is taking too long.")).toBeDefined();
    expect(
      screen.getByText("Try a shorter or more specific query, or clear the search."),
    ).toBeDefined();

    const action = screen.getByRole("link", { name: "Clear search" });
    expect(action.getAttribute("href")).toBe("/dashboard/issues?status=OPEN");
  });
});
