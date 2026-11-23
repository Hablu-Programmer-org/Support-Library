import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireSession: vi.fn(),
  requireMentorOrAdmin: vi.fn(),
  listLiveSupportQueue: vi.fn(),
  generateCsrfToken: vi.fn(),
  getLiveSupportConfig: vi.fn(),
  currentShift: vi.fn(),
  redirect: vi.fn((to: string) => {
    throw new Error(`REDIRECT:${to}`);
  }),
  card: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth-guard", () => ({
  requireSession: mocks.requireSession,
  requireMentorOrAdmin: mocks.requireMentorOrAdmin,
}));
vi.mock("@/lib/services/live-support-joins", () => ({
  listLiveSupportQueue: mocks.listLiveSupportQueue,
}));
vi.mock("@/lib/csrf", () => ({ generateCsrfToken: mocks.generateCsrfToken }));
vi.mock("@/lib/live-support", () => ({ getLiveSupportConfig: mocks.getLiveSupportConfig }));
vi.mock("@/lib/config/live-support", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/config/live-support")>()),
  currentShift: mocks.currentShift,
}));
vi.mock("@/components/live-support/live-support-card", () => ({
  LiveSupportCard: (props: Record<string, unknown>) => {
    mocks.card(props);
    return <section data-testid="room-card" />;
  },
}));
vi.mock("@/components/live-support/join-queue", () => ({
  LiveSupportJoinQueue: ({ entries }: { entries: unknown[] }) => (
    <section data-testid="queue">{entries.length} waiting</section>
  ),
}));
vi.mock("@/components/live-support/queue-refresh", () => ({
  QueueRefresh: () => <button type="button">Refresh</button>,
}));

import LiveSupportPage from "@/app/dashboard/live-support/page";
import SupportRedirectPage from "@/app/dashboard/support/page";

const STAFF_SESSION = { user: { id: "665f1c2ab3c4d5e6f7a8b900", role: "MENTOR" } };
const CONFIG = {
  platform: "Google Meet",
  meetingId: "abc-defg-hij",
  passcode: null,
  joinUrl: "https://meet.example/abc-defg-hij",
};

describe("/dashboard/support (old address)", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(["MENTOR", "ADMIN"])("sends %s to the merged live support page", async (role) => {
    mocks.requireSession.mockResolvedValue({ user: { id: "u1", role } });
    await expect(SupportRedirectPage()).rejects.toThrow("REDIRECT:/dashboard/live-support");
  });

  it("sends a student to their own issues", async () => {
    mocks.requireSession.mockResolvedValue({ user: { id: "u1", role: "STUDENT" } });
    await expect(SupportRedirectPage()).rejects.toThrow("REDIRECT:/dashboard/my-issues");
  });
});

describe("/dashboard/live-support (merged staff page)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireMentorOrAdmin.mockResolvedValue(STAFF_SESSION);
    mocks.listLiveSupportQueue.mockResolvedValue([{ id: "j1" }, { id: "j2" }]);
    mocks.generateCsrfToken.mockResolvedValue("csrf-token");
    mocks.getLiveSupportConfig.mockReturnValue(CONFIG);
  });

  it("shows the room card and today's queue on one page", async () => {
    mocks.currentShift.mockReturnValue("evening");
    render(await LiveSupportPage());

    expect(screen.getByRole("heading", { name: "Live support" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    const card = screen.getByTestId("room-card");
    const queue = screen.getByTestId("queue");
    expect(queue).toHaveTextContent("2 waiting");
    // Card first in DOM so the Join button sits above the queue on mobile.
    expect(card.compareDocumentPosition(queue) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mocks.listLiveSupportQueue).toHaveBeenCalledWith(expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/));
    expect(mocks.generateCsrfToken).toHaveBeenCalledWith(STAFF_SESSION.user.id);
    expect(mocks.card).toHaveBeenCalledWith(
      expect.objectContaining({
        configured: true,
        csrfToken: "csrf-token",
        meetingId: CONFIG.meetingId,
        shift: "evening",
      }),
    );
  });

  it("passes no room details while the room is closed", async () => {
    mocks.currentShift.mockReturnValue("off");
    render(await LiveSupportPage());

    expect(mocks.card).toHaveBeenCalledWith(
      expect.objectContaining({ meetingId: null, passcode: null, shift: "off" }),
    );
  });
});
