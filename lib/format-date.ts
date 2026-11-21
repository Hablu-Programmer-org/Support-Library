import { SUPPORT_TIME_ZONE } from "@/lib/config/live-support";

export function formatSupportDate(date?: Date | string | null): string {
  if (!date) return "Not available";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "Not available";

  // Format in Dhaka time as requested: e.g. "2 Nov 2026, 12:41"
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SUPPORT_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Short day + month ("3 Nov") for compact chips.
 *
 * The locale and the time zone are both fixed. `toLocaleDateString(undefined)`
 * would use the runtime locale, so SSR (Node, default en-US → "Nov 3") and the
 * browser (en-GB → "3 Nov") produced different text and React threw a
 * hydration mismatch. Returns `null` when there is no usable date.
 */
/** Date without a time, for expiry lines such as "7 Nov 2027". */
export function formatSupportDateOnly(date?: Date | string | null): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SUPPORT_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
/** Past this age a relative label stops helping; show the calendar date instead. */
const RELATIVE_MAX_DAYS = 7;

/**
 * Compact age for list rows: "just now", "5m ago", "3h ago", "2d ago", then the
 * Dhaka calendar date ("12 Oct 2026") from 7 days on. `now` is passed in so the
 * server renders it once and tests stay deterministic. A future date (clock
 * skew between DB and app server) reads "just now", never a negative age.
 * Returns `null` when there is no usable date.
 */
export function formatSupportRelative(
  date: Date | string | null | undefined,
  now: Date,
): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime()) || Number.isNaN(now.getTime())) return null;

  const age = now.getTime() - d.getTime();
  if (age < MINUTE_MS) return "just now";
  if (age < HOUR_MS) return `${Math.floor(age / MINUTE_MS)}m ago`;
  if (age < DAY_MS) return `${Math.floor(age / HOUR_MS)}h ago`;
  if (age < RELATIVE_MAX_DAYS * DAY_MS) return `${Math.floor(age / DAY_MS)}d ago`;
  return formatSupportDateOnly(d);
}

export function formatSupportShortDate(date?: Date | string | null): string | null {
  if (!date) return null;
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return null;

  return new Intl.DateTimeFormat("en-GB", {
    timeZone: SUPPORT_TIME_ZONE,
    day: "numeric",
    month: "short",
  }).format(d);
}
