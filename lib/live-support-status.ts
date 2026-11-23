import { SUPPORT_SHIFTS, currentShift, shiftMinutes } from "@/lib/config/live-support";

/**
 * Landing badge: is live support open right now, and when does that change.
 * Derived only from the schedule, so it is safe for guests: no room URL or
 * meeting code is involved.
 */
export type LiveSupportNow = { open: boolean; label: string };

/** Minutes since midnight → "6:30 PM" (1440 → "12:00 AM"). */
export function formatShiftTime(minutes: number): string {
  const normalized = minutes % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(normalized % 60).padStart(2, "0")} ${hour24 < 12 ? "AM" : "PM"}`;
}

const shifts = [...Object.values(SUPPORT_SHIFTS)].sort((a, b) => a.start - b.start);

export function liveSupportNow(date: Date): LiveSupportNow {
  const phase = currentShift(date);
  if (phase !== "off") {
    return {
      open: true,
      label: `Live support open · until ${formatShiftTime(SUPPORT_SHIFTS[phase].end)}`,
    };
  }

  const minutes = shiftMinutes(date);
  const next = shifts.find((shift) => shift.start > minutes);
  return {
    open: false,
    label: next
      ? `Live support closed · opens ${formatShiftTime(next.start)}`
      : `Live support closed · opens ${formatShiftTime(shifts[0].start)} tomorrow`,
  };
}
