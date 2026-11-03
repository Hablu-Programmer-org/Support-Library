import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/live-support", () => ({
  joinLiveSupportAction: vi.fn(),
}));

import { LiveSupportCard } from "@/components/live-support/live-support-card";

const baseProps = {
  platform: "Google Meet",
  meetingId: "abc-defg-hij",
  passcode: null,
  configured: true,
  csrfToken: "csrf-token",
};

describe("LiveSupportCard", () => {
  it("uses the generic new-tab form and keeps the queue open", () => {
    const { container } = render(<LiveSupportCard {...baseProps} shift="morning" />);

    const button = screen.getByRole("button", {
      name: "Join Live support",
    }) as HTMLButtonElement;

    expect(button.disabled).toBe(false);
    expect(button.textContent).toBe("Join Live support");
    expect(screen.getByText("Meeting code")).not.toBeNull();
    expect(screen.queryByText("Passcode")).toBeNull();
    // The platform name is an identifier, not copy: it must not be rendered.
    expect(container.textContent).not.toContain("Google Meet");
  });

  it("disables the join outside a shift and hides the room details", () => {
    render(<LiveSupportCard {...baseProps} shift="off" />);

    const button = screen.getByRole("button", {
      name: "Join Live support",
    }) as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(screen.queryByText("Meeting code")).toBeNull();
  });

  it("fails closed when no room is configured", () => {
    render(<LiveSupportCard {...baseProps} configured={false} shift="morning" />);

    expect(
      screen.getByText("The support room is not configured for this deployment yet."),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Join Live support" })).toBeNull();
  });
});
