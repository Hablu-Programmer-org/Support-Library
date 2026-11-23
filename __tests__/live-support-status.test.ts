import { describe, expect, it } from "vitest";

import { formatShiftTime, liveSupportNow } from "@/lib/live-support-status";

/** Dhaka is UTC+6 with no DST, so a local time maps to a fixed instant. */
const dhaka = (hhmm: string) => new Date(`2026-11-23T${hhmm}:00+06:00`);

describe("formatShiftTime", () => {
  it.each([
    [0, "12:00 AM"],
    [9 * 60, "9:00 AM"],
    [12 * 60, "12:00 PM"],
    [13 * 60, "1:00 PM"],
    [18 * 60 + 30, "6:30 PM"],
    [24 * 60, "12:00 AM"],
  ])("%i minutes → %s", (minutes, expected) => {
    expect(formatShiftTime(minutes)).toBe(expected);
  });
});

describe("liveSupportNow", () => {
  it("open in the morning shift", () => {
    expect(liveSupportNow(dhaka("10:15"))).toEqual({
      open: true,
      label: "Live support open · until 1:00 PM",
    });
  });

  it("open until the last minute of the night shift", () => {
    expect(liveSupportNow(dhaka("21:59")).label).toBe("Live support open · until 10:00 PM");
  });

  it("closed at exactly 13:00 points at the night shift", () => {
    expect(liveSupportNow(dhaka("13:00"))).toEqual({
      open: false,
      label: "Live support closed · opens 6:30 PM",
    });
  });

  it("closed before 9:00 points at the same morning", () => {
    expect(liveSupportNow(dhaka("07:00")).label).toBe("Live support closed · opens 9:00 AM");
  });

  it("closed after the night shift points at tomorrow", () => {
    expect(liveSupportNow(dhaka("22:00")).label).toBe("Live support closed · opens 9:00 AM tomorrow");
  });
});
