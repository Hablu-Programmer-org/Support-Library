import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/live-support", () => ({
  joinLiveSupportQuickAction: vi.fn(async () => ({})),
}));

import { QuickLiveSupportButton } from "@/components/live-support/quick-live-support-button";

const baseProps = {
  configured: true,
  csrfToken: "csrf-token",
};

describe("QuickLiveSupportButton", () => {
  it("offers the join during a shift and carries the CSRF token", () => {
    const { container } = render(<QuickLiveSupportButton {...baseProps} shift="morning" />);

    const button = screen.getByRole("button", { name: "Join Live support" });
    expect((button as HTMLButtonElement).disabled).toBe(false);

    // CSRF travels with the form; the room URL is resolved by the action and is
    // never part of the markup.
    expect(new FormData(container.querySelector("form")!).get("csrfToken")).toBe("csrf-token");
    expect(container.innerHTML.toLowerCase()).not.toContain("meet.google.com");
  });

  it("disables the join outside a shift without showing schedule text", () => {
    const { container } = render(<QuickLiveSupportButton {...baseProps} shift="off" />);

    expect((screen.getByRole("button", { name: "Join Live support" }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect(container.textContent).not.toMatch(/Closed right now|সকাল/);
    expect(screen.getByRole("button", { name: "Join Live support" }).parentElement?.parentElement?.getAttribute("title"))
      .toBe("Live support is closed right now");
  });

  it("hides the join when the deployment has no room", () => {
    render(<QuickLiveSupportButton configured={false} csrfToken="csrf-token" shift="morning" />);

    expect((screen.getByRole("button", { name: "Join Live support" }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect(screen.queryByText("Live support is unavailable right now.")).toBeNull();
  });
});
