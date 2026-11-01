import "server-only";

import {
  LIVE_SUPPORT_PLATFORM,
  type LiveSupportConfig,
} from "@/lib/config/live-support";

/**
 * Live support meeting details, resolved from the environment.
 *
 * These values deliberately stay **server-side**: the page passes them to the
 * client card only after the session check, so an anonymous visitor never sees
 * the join URL, meeting code or passcode. The LMS frontend carries none of them
 * either — `scripts/check-live-support-sync.ts` fails the release if one
 * reappears in its public config.
 *
 * No room value has a source default. On Google Meet the join URL *is* the key
 * to the room, so committing one would put a live credential in git and make
 * every environment advertise that one room. Instead:
 *  - production refuses to boot without `LIVE_SUPPORT_JOIN_URL` (see `lib/env.ts`);
 *  - local/self-hosted runs without it simply show a closed room, and
 *  - rotating a leaked room is an environment change, never a code change.
 *
 * The platform name is not a secret, so it keeps a default.
 */

/**
 * `undefined` (unset) falls back; an explicitly empty value means "none".
 *
 * The old reader fell back on empty too, which meant setting
 * `LIVE_SUPPORT_PASSCODE=""` for Google Meet silently restored the previous
 * platform's passcode. Empty must mean "absent".
 */
const readOptional = (value: string | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed || null;
};

const readPlatform = (value: string | undefined): string => {
  const trimmed = (value ?? "").trim();
  return trimmed || LIVE_SUPPORT_PLATFORM;
};

export function getLiveSupportConfig(): LiveSupportConfig {
  return {
    platform: readPlatform(process.env.LIVE_SUPPORT_PLATFORM),
    joinUrl: readOptional(process.env.LIVE_SUPPORT_JOIN_URL),
    meetingId: readOptional(process.env.LIVE_SUPPORT_MEETING_ID),
    passcode: readOptional(process.env.LIVE_SUPPORT_PASSCODE),
  };
}

/**
 * Whether a room can be joined at all.
 *
 * Production enforces this at boot; the check exists so a development or
 * self-hosted instance without a room renders a closed panel instead of a
 * button that redirects nowhere.
 */
export const isLiveSupportConfigured = (
  config: LiveSupportConfig = getLiveSupportConfig(),
): boolean => Boolean(config.joinUrl);
