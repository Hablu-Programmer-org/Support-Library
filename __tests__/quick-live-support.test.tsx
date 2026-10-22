import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/live-support", () => ({
  joinLiveSupportQuickAction: vi.fn(),
}));

import { QuickLiveSupportButton } from "@/components/live-support/quick-live-support-button";

const baseProps = {
  platform: "Zoom",
  csrfToken: "csrf-token",
};

const openDialog = () => {
  fireEvent.click(screen.getByRole("button", { name: "Join live support" }));
  return screen.getByRole("dialog", { name: "Join live support" });
};

describe("QuickLiveSupportButton (temporary)", () => {
  it("stays closed until the student asks for it", () => {
    render(<QuickLiveSupportButton {...baseProps} shift="morning" />);

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Join live support" }).getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("explains the request-first path and offers both actions", () => {
    const { container } = render(<QuickLiveSupportButton {...baseProps} shift="morning" />);

    const dialog = openDialog();

    // The popup still teaches the supported journey.
    expect(dialog.textContent).toContain("so the mentor can see your problem");

    const submitLink = screen.getByRole("link", { name: "Submit an issue" });
    expect(submitLink.getAttribute("href")).toBe("/dashboard/issues/new");

    const joinButton = screen.getByRole("button", { name: "Join Zoom Meeting" });
    expect((joinButton as HTMLButtonElement).disabled).toBe(false);

    // CSRF is carried by the form, and the room URL is never in the markup.
    expect(new FormData(container.querySelector("form")!).get("csrfToken")).toBe("csrf-token");
    expect(container.innerHTML.toLowerCase()).not.toContain("zoom.us");
  });

  it("blocks the join outside a support slot", () => {
    render(<QuickLiveSupportButton {...baseProps} shift="off" />);

    openDialog();

    expect(
      screen.getByText("Live support is closed right now. Please join during a support slot."),
    ).not.toBeNull();
    expect((screen.getByRole("button", { name: "Join Zoom Meeting" }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it("closes on Escape", () => {
    render(<QuickLiveSupportButton {...baseProps} shift="morning" />);

    openDialog();
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
