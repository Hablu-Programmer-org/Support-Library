import "server-only";

import type { LiveSupportConfig } from "@/lib/config/live-support";

/**
 * Live support meeting details, resolved from the environment.
 *
 * These values deliberately stay **server-side**: the page passes them to the
 * client card only after the session check, so an anonymous visitor never sees
 * the join URL, meeting ID or passcode. (The LMS frontend puts the same values
 * in its public bundle — this is the one place where the two apps differ on
 * purpose.)
 *
 * Defaults match the live Hablu Programmer Zoom room, so an unset environment
 * still works; overriding is only needed for a different room.
 */

const DEFAULT_LIVE_SUPPORT: LiveSupportConfig = {
  platform: "Zoom",
  joinUrl:
    "https://cuny.zoom.us/j/88027275113?pwd=sKXvuiz2Gdzt6X3ysieurq0o1xPZwk.1",
  meetingId: "880 2727 5113",
  passcode: "YNL4me",
};

const read = (value: string | undefined, fallback: string) => {
  const trimmed = (value ?? "").trim();
  return trimmed || fallback;
};

export function getLiveSupportConfig(): LiveSupportConfig {
  return {
    platform: read(process.env.LIVE_SUPPORT_PLATFORM, DEFAULT_LIVE_SUPPORT.platform),
    joinUrl: read(process.env.LIVE_SUPPORT_JOIN_URL, DEFAULT_LIVE_SUPPORT.joinUrl),
    meetingId: read(process.env.LIVE_SUPPORT_MEETING_ID, DEFAULT_LIVE_SUPPORT.meetingId),
    passcode: read(process.env.LIVE_SUPPORT_PASSCODE, DEFAULT_LIVE_SUPPORT.passcode),
  };
}
