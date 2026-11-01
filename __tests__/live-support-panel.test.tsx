import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/live-support", () => ({
  joinLiveSupportAction: vi.fn(),
}));

import { LiveSupportPanel } from "@/components/live-support/live-support-panel";

/**
 * The live room is Google Meet: no passcode, and the manual-entry row is the
 * meeting code. The room URL itself must never reach the markup.
 */
const baseProps = {
  issueId: "66f1a2b3c4d5e6f7a8b9c0d1",
  platform: "Google Meet",
  meetingId: "moe-ooac-amo",
  passcode: null,
  configured: true,
  csrfToken: "csrf-token",
  status: "OPEN" as const,
};

const joinButton = () =>
  screen.getByRole("button", {
    name: "Live Support Center (Google Meet)",
  }) as HTMLButtonElement;

describe("LiveSupportPanel", () => {
  it("submits this page's request with a CSRF token", () => {
    const { container } = render(<LiveSupportPanel {...baseProps} shift="morning" />);

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    const data = new FormData(form!);

    // The request is fixed by the page: no picker, so no way to serialise a
    // different case from the UI (the action re-checks ownership anyway).
    expect(data.get("issueId")).toBe(baseProps.issueId);
    expect(data.get("csrfToken")).toBe("csrf-token");
    expect(container.querySelector("select")).toBeNull();

    expect(joinButton().disabled).toBe(false);
    expect(joinButton().textContent).toBe("Join Google Meet");
    expect(screen.getByText(/Opens in a new tab/)).not.toBeNull();
    expect(screen.getByText("Meeting code")).not.toBeNull();
    // Google Meet has no passcode row at all.
    expect(screen.queryByText("Passcode")).toBeNull();
  });

  it("never renders the meeting link itself", () => {
    const { container } = render(<LiveSupportPanel {...baseProps} shift="night" />);

    expect(container.innerHTML.toLowerCase()).not.toContain("meet.google.com");
    expect(container.querySelector('a[href^="https://"]')).toBeNull();
  });

  it("blocks the join outside a support slot and hides the meeting code", () => {
    render(<LiveSupportPanel {...baseProps} shift="off" />);

    expect(
      screen.getByText("Live support is closed right now. Please join during a support slot."),
    ).not.toBeNull();
    expect(joinButton().disabled).toBe(true);
    expect(screen.queryByText("Meeting code")).toBeNull();
    expect(screen.queryByText("Passcode")).toBeNull();
  });

  it("offers no join once the request is solved or archived", () => {
    render(<LiveSupportPanel {...baseProps} shift="morning" status="SOLVED" />);

    expect(
      screen.getByText(/This request is closed, so it can no longer be taken to the room/),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Live Support Center (Google Meet)" })).toBeNull();
    // A closed request also gets no dial-in details: the room is not for it.
    expect(screen.queryByText("Meeting code")).toBeNull();
  });

  it("fails closed when the deployment has no room configured", () => {
    const { container } = render(
      <LiveSupportPanel {...baseProps} configured={false} shift="morning" />,
    );

    expect(
      screen.getByText("The support room is not configured for this deployment yet."),
    ).not.toBeNull();
    expect(container.querySelector("form")).toBeNull();
    expect(screen.queryByRole("button", { name: "Live Support Center (Google Meet)" })).toBeNull();
  });

  it("still renders a passcode for a platform that has one", () => {
    render(
      <LiveSupportPanel
        {...baseProps}
        meetingId="880 4127 4100"
        passcode="abc123"
        platform="Zoom"
        shift="morning"
      />,
    );

    expect(screen.getByText("Meeting ID")).not.toBeNull();
    expect(screen.getByText("Passcode")).not.toBeNull();
    expect(
      screen.getByRole("button", { name: "Live Support Center (Zoom)" }).textContent,
    ).toBe("Join Zoom");
  });
});
