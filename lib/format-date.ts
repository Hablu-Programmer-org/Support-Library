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
