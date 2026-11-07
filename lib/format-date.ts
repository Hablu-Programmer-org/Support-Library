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
