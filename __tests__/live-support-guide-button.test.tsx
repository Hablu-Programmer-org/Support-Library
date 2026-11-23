import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("@/actions/live-support", () => ({
  joinLiveSupportQuickAction: vi.fn(async () => ({})),
}));

import { LiveSupportGuideButton } from "@/components/live-support/live-support-guide-button";

// jsdom has no modal dialog support; mimic the open/close attribute contract.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

const renderGuide = () =>
  render(<LiveSupportGuideButton statusLabel="Live support open · until 1:00 PM." />);

describe("LiveSupportGuideButton", () => {
  it("is always enabled and never ships the room", () => {
    const { container } = renderGuide();
    const button = screen.getByRole("button", { name: "Join Live support" });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(container.innerHTML.toLowerCase()).not.toContain("meet.google.com");
    expect(container.querySelector("form")).toBeNull();
  });

  it("opens the how-to dialog with the steps, the status and both links", () => {
    const { container } = renderGuide();
    const dialog = container.querySelector("dialog")!;
    expect(dialog.hasAttribute("open")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "Join Live support" }));
    expect(dialog.hasAttribute("open")).toBe(true);

    expect(screen.getByText("How to get live support")).toBeTruthy();
    expect(screen.getByText("Live support open · until 1:00 PM.")).toBeTruthy();
    const steps = dialog.querySelectorAll("ol > li");
    expect(steps).toHaveLength(3);
    expect(steps[0].textContent).toContain("Create an issue");
    expect(steps[2].textContent).toContain("reference number");
    expect(screen.getByRole("link", { name: "Create an issue", hidden: true }).getAttribute("href")).toBe(
      "/dashboard/issues/new",
    );
    expect(screen.getByRole("link", { name: "My issues", hidden: true }).getAttribute("href")).toBe(
      "/dashboard/my-issues",
    );
  });

  it("offers a direct join inside the dialog, enabled only in an open shift", () => {
    const join = { csrfToken: "csrf-token", configured: true };
    const { container, rerender } = render(
      <LiveSupportGuideButton join={{ ...join, shift: "morning" }} statusLabel="open" />,
    );
    const dialog = container.querySelector("dialog")!;
    const direct = within(dialog).getByRole("button", { name: "Join Live support", hidden: true });
    expect((direct as HTMLButtonElement).disabled).toBe(false);
    // CSRF travels with the form; the room URL never reaches the markup.
    expect(new FormData(dialog.querySelector("form")!).get("csrfToken")).toBe("csrf-token");
    expect(container.innerHTML.toLowerCase()).not.toContain("meet.google.com");

    rerender(<LiveSupportGuideButton join={{ ...join, shift: "off" }} statusLabel="closed" />);
    expect(
      (within(dialog).getByRole("button", { name: "Join Live support", hidden: true }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("closes from the Close button and from a backdrop click", () => {
    const { container } = renderGuide();
    const dialog = container.querySelector("dialog")!;
    const open = () => fireEvent.click(screen.getByRole("button", { name: "Join Live support" }));

    open();
    fireEvent.click(screen.getByRole("button", { name: "Close", hidden: true }));
    expect(dialog.hasAttribute("open")).toBe(false);

    open();
    fireEvent.click(dialog);
    expect(dialog.hasAttribute("open")).toBe(false);
  });
});
