// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { getLiveSupportConfig, isLiveSupportConfigured } = await import("@/lib/live-support");

const MANAGED_VARS = [
  "LIVE_SUPPORT_PLATFORM",
  "LIVE_SUPPORT_JOIN_URL",
  "LIVE_SUPPORT_MEETING_ID",
  "LIVE_SUPPORT_PASSCODE",
] as const;

const originalEnv = { ...process.env };

function clearRoom() {
  for (const key of MANAGED_VARS) delete process.env[key];
}

afterEach(() => {
  clearRoom();
  Object.assign(process.env, originalEnv);
});

describe("getLiveSupportConfig", () => {
  it("ships the platform label but no committed room credential", () => {
    clearRoom();
    const config = getLiveSupportConfig();

    expect(config.platform).toBe("Google Meet");
    // A live room URL is a credential on Meet: it must come from the
    // environment, never from source that is committed to git.
    expect(config.joinUrl).toBeNull();
    expect(config.meetingId).toBeNull();
    expect(config.passcode).toBeNull();
    expect(isLiveSupportConfigured(config)).toBe(false);
  });

  it("reads the room from the environment", () => {
    process.env.LIVE_SUPPORT_PLATFORM = "Google Meet";
    process.env.LIVE_SUPPORT_JOIN_URL = " https://meet.google.com/abc-defg-hij ";
    process.env.LIVE_SUPPORT_MEETING_ID = "abc-defg-hij";

    const config = getLiveSupportConfig();

    expect(config.joinUrl).toBe("https://meet.google.com/abc-defg-hij");
    expect(config.meetingId).toBe("abc-defg-hij");
    expect(config.passcode).toBeNull();
    expect(isLiveSupportConfigured(config)).toBe(true);
  });

  it("treats an explicitly empty value as absent, not as a fallback", () => {
    process.env.LIVE_SUPPORT_PASSCODE = "   ";

    // The old reader fell back on empty, which restored the previous platform's
    // passcode when a deployment cleared it for Google Meet.
    expect(getLiveSupportConfig().passcode).toBeNull();
  });

  it("falls back to the platform label when the value is empty", () => {
    process.env.LIVE_SUPPORT_PLATFORM = "";

    expect(getLiveSupportConfig().platform).toBe("Google Meet");
  });
});
