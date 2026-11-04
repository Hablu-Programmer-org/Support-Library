import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";

describe("StatCard", () => {
  it("renders the metric, label and hint", () => {
    render(<StatCard hint="Open or pending" label="Unresolved" tone="warning" value={12} />);

    expect(screen.getByText("Unresolved")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("Open or pending")).toBeTruthy();
  });

  it("links to the queue that can act on the number", () => {
    render(<StatCard href="/dashboard/issues" label="Waiting Now" value={3} />);

    const link = screen.getByRole("link", { name: /Waiting Now/ });
    expect(link.getAttribute("href")).toBe("/dashboard/issues");
  });

  it("stays a plain card without an href", () => {
    const { container } = render(<StatCard label="Support Issues" value={0} />);

    expect(container.querySelector("a")).toBeNull();
    expect(screen.getByText("0")).toBeTruthy();
  });
});

describe("EmptyState", () => {
  it("keeps the message and shows an optional action", () => {
    render(
      <EmptyState action={<button type="button">Clear filters</button>} description="Try a wider range.">
        No requests match.
      </EmptyState>,
    );

    expect(screen.getByText("No requests match.")).toBeTruthy();
    expect(screen.getByText("Try a wider range.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Clear filters" })).toBeTruthy();
  });
});

describe("PageHeader", () => {
  it("renders the exact page title as the h1", () => {
    render(<PageHeader description="Today" eyebrow="Operations" title="Dashboard" />);

    expect(screen.getByRole("heading", { level: 1, name: "Dashboard" })).toBeTruthy();
    expect(screen.getByText("Operations")).toBeTruthy();
  });
});
