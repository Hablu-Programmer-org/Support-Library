import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { AutoRefresh } from "@/components/shared/auto-refresh";

const fetchMock = vi.fn();

/** Advance fake time and let the probe's promises settle. */
async function tick(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("AutoRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    refresh.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("does not refresh when the revision is unchanged", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ revision: "r1" }) });

    render(<AutoRefresh endpoint="/api/x/activity" initialRevision="r1" intervalMs={10_000} />);
    await tick(10_000);

    expect(fetchMock).toHaveBeenCalledWith("/api/x/activity", { cache: "no-store" });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("refreshes exactly once when the revision changes", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ revision: "r2" }) });

    render(<AutoRefresh endpoint="/api/x/activity" initialRevision="r1" intervalMs={10_000} />);
    await tick(10_000);
    expect(refresh).toHaveBeenCalledTimes(1);

    // The server render now carries r2; the next probe must not loop.
    await tick(10_000);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not probe while the tab is hidden", async () => {
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ revision: "r2" }) });

    render(<AutoRefresh endpoint="/api/x/activity" initialRevision="r1" intervalMs={10_000} />);
    await tick(30_000);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("backs off after a failed probe instead of hammering the API", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });

    render(<AutoRefresh endpoint="/api/x/activity" initialRevision="r1" intervalMs={10_000} />);
    await tick(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Failure doubles the wait to 20s, so the next slot at 20s is skipped.
    await tick(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await tick(10_000);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes on demand", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ revision: "r1" }) });

    render(<AutoRefresh endpoint="/api/x/activity" initialRevision="r1" intervalMs={10_000} />);
    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("shows the status as a visible caption by default", () => {
    render(<AutoRefresh endpoint="/api/x/activity" initialRevision="r1" intervalMs={10_000} />);
    const caption = screen.getByText("Auto-updates");
    expect(caption.className).not.toContain("sr-only");
    expect(screen.queryByTestId("auto-refresh-dot")).toBeNull();
  });

  it("folds the status into the button in dot mode", () => {
    render(
      <AutoRefresh endpoint="/api/x/activity" initialRevision="r1" intervalMs={10_000} status="dot" />,
    );
    const button = screen.getByRole("button", { name: "Refresh" });
    expect(button.getAttribute("title")).toBe("Auto-updates");
    expect(screen.getByTestId("auto-refresh-dot")).toBeTruthy();
    // Still announced, but no loose caption on screen.
    const status = screen.getByText("Auto-updates");
    expect(status.className).toContain("sr-only");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("reports the manual refresh time in dot mode", () => {
    vi.setSystemTime(new Date("2026-11-22T08:05:00Z"));
    render(
      <AutoRefresh endpoint="/api/x/activity" initialRevision="r1" intervalMs={10_000} status="dot" />,
    );
    const button = screen.getByRole("button", { name: "Refresh" });
    fireEvent.click(button);
    // Dhaka is UTC+6.
    expect(button.getAttribute("title")).toBe("Updated 14:05");
    expect(screen.getByText("Updated 14:05").className).toContain("sr-only");
  });
});
