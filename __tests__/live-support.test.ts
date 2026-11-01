// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  currentShift,
  dayKeyInDhaka,
  formatCaseRef,
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
  it("stays closed just before the morning shift opens", () => {
    // 02:59 UTC is 08:59 in Dhaka.
    expect(currentShift(dhaka(2, 59))).toBe("off");
  });

  it("opens the morning shift at exactly 09:00 Dhaka", () => {
    expect(currentShift(dhaka(3, 0))).toBe("morning");
  });

  it("keeps the morning shift until 13:00 is not yet reached", () => {
    expect(currentShift(dhaka(6, 59))).toBe("morning");
  });

  it("closes exactly at 13:00", () => {
    expect(currentShift(dhaka(7, 0))).toBe("off");
  });

  it("stays closed through the afternoon", () => {
    expect(currentShift(dhaka(11, 0))).toBe("off");
  });

  it("stays closed just before the night shift opens", () => {
    // 12:29 UTC is 18:29 in Dhaka.
    expect(currentShift(dhaka(12, 29))).toBe("off");
  });

  it("opens the night shift at exactly 18:30 Dhaka", () => {
    expect(currentShift(dhaka(12, 30))).toBe("night");
  });

  it("keeps the night shift until 22:00 is not yet reached", () => {
    expect(currentShift(dhaka(15, 59))).toBe("night");
  });

  it("closes at 22:00 and never spills into the next day", () => {
    expect(currentShift(dhaka(16, 0))).toBe("off");
    expect(currentShift(dhaka(18, 0))).toBe("off");
  });

  it("uses the studio timezone rather than the device's", () => {
    // 03:00 UTC is 09:00 in Dhaka: on a UTC machine the device clock says the
    // room is closed, so this only passes when the shift is resolved in Dhaka.
    expect(currentShift(dhaka(3, 0))).not.toBe("off");
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
  it("covers the windows the owner announced on 2026-11-01", () => {
    expect(SUPPORT_SHIFTS.morning).toEqual({ start: 9 * 60, end: 13 * 60 });
    expect(SUPPORT_SHIFTS.night).toEqual({ start: 18 * 60 + 30, end: 22 * 60 });
  });
});

describe("Bengali schedule copy", () => {  it("converts digits to Bengali numerals", () => {
    expect(toBnDigits("12")).toBe("১২");
    expect(toBnDigits(730)).toBe("৭৩০");
  });

  it("spells out both shifts in the same words as the frontend", () => {
    // Byte-for-byte the LMS frontend's sentence, so a student sees identical
    // copy whichever app they open. `scripts/check-live-support-sync.ts`
    // compares the same words in the two source files.
    expect(supportScheduleBn).toBe(
      "সকাল ৯ টা থেকে দুপুর ১ টা এবং সন্ধ্যা ৬:৩০ থেকে রাত ১০ টা",
    );
  });

  it("adds up the daily hours", () => {
    expect(supportHoursBn()).toBe("৭ ঘণ্টা ৩০ মিনিট");
  });
});

describe("dayKeyInDhaka", () => {
  it("uses the studio's calendar day, not the UTC day", () => {
    // 02:00 UTC on the 18th is 08:00 on the 18th in Dhaka.
    expect(dayKeyInDhaka(dhaka(2, 0))).toBe("2026-10-18");
  });

  it("rolls over at Dhaka midnight, six hours before UTC does", () => {
    // 18:00 UTC is 00:00 on the 19th in Dhaka.
    expect(dayKeyInDhaka(dhaka(18, 0))).toBe("2026-10-19");
    // 17:59 UTC is still 23:59 on the 18th in Dhaka.
    expect(dayKeyInDhaka(dhaka(17, 59))).toBe("2026-10-18");
  });

  it("keeps the two shifts of one Dhaka day on the same key", () => {
    // 09:30 and 19:00 Dhaka are both part of the 18th, so a student who joins
    // twice — morning and night — collides on the same idempotency key.
    expect(dayKeyInDhaka(dhaka(3, 30))).toBe("2026-10-18");
    expect(dayKeyInDhaka(dhaka(13, 0))).toBe("2026-10-18");
  });
});

describe("formatCaseRef", () => {
  it("is six digits a student can read out loud", () => {
    expect(formatCaseRef(1)).toBe("000001");
    expect(formatCaseRef(274819)).toBe("274819");
  });

  it("never contains letters, which are easy to mishear", () => {
    expect(formatCaseRef(123456)).toMatch(/^\d{6}$/);
  });
});
