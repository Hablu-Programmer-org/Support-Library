// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ExternalActionForm } from "@/components/shared/external-action-form";
import type { ExternalRedirectState } from "@/lib/external-redirect";

const ROOM_URL = "https://meet.google.com/abc-defg-hij";

type FakeTab = {
  closed: boolean;
  opener: unknown;
  location: { replace: ReturnType<typeof vi.fn> };
  close: ReturnType<typeof vi.fn>;
  document: {
    title: string;
    createElement: () => { textContent: string; style: { cssText: string } };
    body: { replaceChildren: ReturnType<typeof vi.fn> };
  };
};

function fakeTab(): FakeTab {
  const note = { textContent: "", style: { cssText: "" } };
  return {
    closed: false,
    opener: {},
    location: { replace: vi.fn() },
    close: vi.fn(),
    document: {
      title: "",
      createElement: () => note,
      body: { replaceChildren: vi.fn() },
    },
  };
}

function renderForm(
  action: (state: ExternalRedirectState, formData: FormData) => Promise<ExternalRedirectState>,
  overrides: Partial<ComponentProps<typeof ExternalActionForm>> = {},
) {
  return render(
    <ExternalActionForm
      action={action}
      fallbackLabel="Open Live support"
      fields={{ csrfToken: "csrf-token", issueId: "issue-id" }}
      hint="Opens in a new tab"
      label="Join Live support"
      pendingLabel="Opening Live support…"
      {...overrides}
    />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ExternalActionForm", () => {
  it("opens the returned URL in the tab opened by the click", async () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const action = vi.fn(async () => ({ url: ROOM_URL }));

    renderForm(action);
    fireEvent.click(screen.getByRole("button", { name: "Join Live support" }));

    await waitFor(() => expect(tab.location.replace).toHaveBeenCalledWith(ROOM_URL));

    // Opened inside the gesture, with the opener severed (reverse tabnabbing).
    expect(open).toHaveBeenCalledWith("", "_blank");
    expect(tab.opener).toBeNull();
    // A real link is also rendered, so a blocked tab still has a way in.
    expect(screen.getByRole("link", { name: "Open Live support" })).not.toBeNull();
  });

  it("falls back to a new-tab link when the popup is blocked", async () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    const action = vi.fn(async () => ({ url: ROOM_URL }));

    renderForm(action);
    fireEvent.click(screen.getByRole("button", { name: "Join Live support" }));

    const link = await screen.findByRole("link", { name: "Open Live support" });
    expect(link.getAttribute("href")).toBe(ROOM_URL);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
    expect(link.getAttribute("rel")).toContain("noreferrer");
  });

  it("closes the pre-opened tab and shows the error when the action fails", async () => {
    const tab = fakeTab();
    vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const action = vi.fn(async () => ({ error: "Live support is closed right now." }));

    renderForm(action);
    fireEvent.click(screen.getByRole("button", { name: "Join Live support" }));

    await waitFor(() => expect(tab.close).toHaveBeenCalled());
    expect(screen.getByRole("alert").textContent).toContain("Live support is closed right now.");
    expect(screen.queryByRole("link", { name: "Open Live support" })).toBeNull();
  });

  it("opens only one tab on a double click", async () => {
    const tab = fakeTab();
    const open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
    const action = vi.fn(async () => ({ url: ROOM_URL }));

    renderForm(action);
    const button = screen.getByRole("button", { name: "Join Live support" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(open).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(tab.location.replace).toHaveBeenCalledWith(ROOM_URL));
  });

  it("renders the hidden fields the caller supplies", () => {
    renderForm(vi.fn(async () => ({})));

    const form = document.querySelector("form")!;
    const data = new FormData(form);
    expect(data.get("csrfToken")).toBe("csrf-token");
    expect(data.get("issueId")).toBe("issue-id");
  });

  it("keeps the button disabled when the caller blocks it", () => {
    renderForm(vi.fn(async () => ({})), { disabled: true });

    expect(
      (screen.getByRole("button", { name: "Join Live support" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
