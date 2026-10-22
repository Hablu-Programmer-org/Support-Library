import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/actions/live-support", () => ({
  joinLiveSupportAction: vi.fn(),
}));

import { LiveSupportPanel } from "@/components/live-support/live-support-panel";

const baseProps = {
  issueId: "66f1a2b3c4d5e6f7a8b9c0d1",
  platform: "Zoom",
  meetingId: "880 2727 5113",
  passcode: "YNL4me",
  csrfToken: "csrf-token",
  status: "OPEN" as const,
};

const joinButton = () =>
  screen.getByRole("button", { name: "Live Support Center (Zoom)" }) as HTMLButtonElement;

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
    expect(screen.getByText("Meeting ID")).not.toBeNull();
  });

  it("never renders the meeting link itself", () => {
    const { container } = render(<LiveSupportPanel {...baseProps} shift="night" />);

    expect(container.innerHTML.toLowerCase()).not.toContain("zoom.us");
    expect(container.querySelector('a[href^="https://"]')).toBeNull();
  });

  it("blocks the join outside a support slot and hides the dial-in details", () => {
    render(<LiveSupportPanel {...baseProps} shift="off" />);

    expect(
      screen.getByText("Live support is closed right now. Please join during a support slot."),
    ).not.toBeNull();
    expect(joinButton().disabled).toBe(true);
    expect(screen.queryByText("Meeting ID")).toBeNull();
    expect(screen.queryByText("Passcode")).toBeNull();
  });

  it("offers no join once the request is solved or archived", () => {
    render(<LiveSupportPanel {...baseProps} shift="morning" status="SOLVED" />);

    expect(
      screen.getByText(/This request is closed, so it can no longer be taken to the room/),
    ).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Live Support Center (Zoom)" })).toBeNull();
    // A closed request also gets no dial-in details: the room is not for it.
    expect(screen.queryByText("Meeting ID")).toBeNull();
  });
});
