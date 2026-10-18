// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  currentShift,
  shiftMinutes,
  supportHoursBn,
  supportScheduleBn,
  SUPPORT_SHIFTS,
  toBnDigits,
} from "@/lib/config/live-support";

/**
 * Shifts are resolved in Asia/Dhaka (UTC+6, no DST since 2010), so every case
 * below is expressed as a UTC instant — the assertions then hold on any machine
 * regardless of its own timezone, which is exactly the bug being fixed.
 */
const dhaka = (utcHour: number, utcMinute = 0) =>
  new Date(Date.UTC(2026, 9, 18, utcHour, utcMinute));

describe("currentShift", () => {
  it("opens the morning shift at exactly 08:00 Dhaka", () => {
    expect(currentShift(dhaka(2, 0))).toBe("morning");
  });

  it("keeps the morning shift until 12:00 is not yet reached", () => {
    expect(currentShift(dhaka(5, 59))).toBe("morning");
  });

  it("closes exactly at noon", () => {
    expect(currentShift(dhaka(6, 0))).toBe("off");
  });

  it("stays closed through the afternoon", () => {
    expect(currentShift(dhaka(10, 0))).toBe("off");
  });

  it("opens the night shift at exactly 19:30 Dhaka", () => {
    expect(currentShift(dhaka(13, 30))).toBe("night");
  });

  it("keeps the night shift until midnight is not yet reached", () => {
    expect(currentShift(dhaka(17, 59))).toBe("night");
  });

  it("closes at midnight and never spills into the next day", () => {
    expect(currentShift(dhaka(18, 0))).toBe("off");
  });

  it("uses the studio timezone rather than the device's", () => {
    // 02:00 UTC is 08:00 in Dhaka: on a UTC machine the device clock says the
    // room is closed, so this only passes when the shift is resolved in Dhaka.
    expect(currentShift(dhaka(2, 0))).not.toBe("off");
  });
});

describe("shiftMinutes", () => {
  it("reports minutes since midnight in the studio timezone", () => {
    expect(shiftMinutes(dhaka(2, 30))).toBe(8 * 60 + 30);
  });

  it("treats midnight as 0, not 1440", () => {
    expect(shiftMinutes(dhaka(18, 0))).toBe(0);
  });
});

describe("SUPPORT_SHIFTS", () => {
  it("covers the windows the owner confirmed", () => {
    expect(SUPPORT_SHIFTS.morning).toEqual({ start: 8 * 60, end: 12 * 60 });
    expect(SUPPORT_SHIFTS.night).toEqual({ start: 19 * 60 + 30, end: 24 * 60 });
  });
});

describe("Bengali schedule copy", () => {
  it("converts digits to Bengali numerals", () => {
    expect(toBnDigits("12")).toBe("১২");
    expect(toBnDigits(730)).toBe("৭৩০");
  });

  it("spells out both shifts in the same words as the frontend", () => {
    // Byte-for-byte the LMS frontend's sentence, so a student sees identical
    // copy whichever app they open. `scripts/check-live-support-sync.ts`
    // compares the same words in the two source files.
    expect(supportScheduleBn).toBe(
      "সকাল ৮ টা থেকে দুপুর ১২ টা এবং সন্ধ্যা ৭:৩০ থেকে রাত ১২ টা",
    );
  });

  it("adds up the daily hours", () => {
    expect(supportHoursBn()).toBe("৮ ঘণ্টা ৩০ মিনিট");
  });
});
