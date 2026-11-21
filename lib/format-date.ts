import { SUPPORT_TIME_ZONE } from "@/lib/config/live-support";

type TimeOptions = { seconds?: boolean };

const hour24Formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: SUPPORT_TIME_ZONE,
  hour: "2-digit",
  hourCycle: "h23",
});

const timeFormatters = new Map<boolean, Intl.DateTimeFormat>();
const timeFormatter = (seconds: boolean) => {
  let formatter = timeFormatters.get(seconds);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: SUPPORT_TIME_ZONE,
      hour: "numeric",
      minute: "2-digit",
      ...(seconds ? { second: "2-digit" as const } : {}),
      // h12 (1–12), never h11: midnight reads "12:05 AM", not "0:05 AM".
      hourCycle: "h12",
    });
    timeFormatters.set(seconds, formatter);
  }
  return formatter;
};

/**
 * 12-hour Dhaka clock time: "9:46 PM", or "9:46:05 PM" with seconds.
 *
 * Built from `formatToParts` so the output never depends on the locale's own
 * spelling of the day period (en-GB says "pm", some engines "p.m.").
 */
export function formatSupportTime(date: Date, options: TimeOptions = {}): string {
  const parts = timeFormatter(Boolean(options.seconds)).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  const hours = Number.parseInt(part("hour"), 10);
  const clock = [String(hours), part("minute"), ...(options.seconds ? [part("second")] : [])].join(":");
  // Derive AM/PM from the 24h hour, not the localized day-period string.
  const hour24 = Number.parseInt(hour24Formatter.format(date), 10);
  return `${clock} ${hour24 < 12 ? "AM" : "PM"}`;
}

export function formatSupportDate(date?: Date | string | null): string {
  if (!date) return "Not available";
  const d = typeof date === "string" ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return "Not available";

  // Dhaka time, 12-hour clock: e.g. "2 Nov 2026, 12:41 PM".
  return `${formatSupportDateOnly(d)}, ${formatSupportTime(d)}`;
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
