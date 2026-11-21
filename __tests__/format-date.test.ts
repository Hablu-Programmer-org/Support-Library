import { describe, expect, it } from "vitest";

import { formatSupportDate, formatSupportShortDate, formatSupportTime } from "@/lib/format-date";

describe("formatSupportTime", () => {
  it("is a 12-hour Dhaka clock with upper-case AM/PM", () => {
    expect(formatSupportTime(new Date("2026-11-19T15:46:00.000Z"))).toBe("9:46 PM");
    expect(formatSupportTime(new Date("2026-11-19T06:00:00.000Z"))).toBe("12:00 PM");
    expect(formatSupportTime(new Date("2026-11-19T18:00:00.000Z"))).toBe("12:00 AM");
  });

  it("adds seconds on request", () => {
    expect(formatSupportTime(new Date("2026-11-19T15:46:05.000Z"), { seconds: true })).toBe("9:46:05 PM");
  });

  it("never prints a 24-hour or zero hour", () => {
    for (let hour = 0; hour < 24; hour += 1) {
      const text = formatSupportTime(new Date(Date.UTC(2026, 10, 19, hour, 0)));
      expect(text).toMatch(/^(1[0-2]|[1-9]):00 (AM|PM)$/);
    }
  });
});

describe("formatSupportShortDate", () => {
  it("formats in Dhaka time with a fixed en-GB locale", () => {
    // 18:30 UTC is already the next day in Dhaka (UTC+6).
    expect(formatSupportShortDate("2026-11-02T18:30:00.000Z")).toBe("3 Nov");
    expect(formatSupportShortDate(new Date("2026-11-02T10:00:00.000Z"))).toBe("2 Nov");
  });

  it("returns null for a missing or unusable date", () => {
    expect(formatSupportShortDate()).toBeNull();
    expect(formatSupportShortDate(null)).toBeNull();
    expect(formatSupportShortDate("")).toBeNull();
    expect(formatSupportShortDate("not-a-date")).toBeNull();
  });

  it("never depends on the runtime locale", () => {
    // en-US would render "Nov 3"; the helper must always render "3 Nov".
    const formatted = formatSupportShortDate("2026-11-03T06:00:00.000Z");
    expect(formatted).toBe("3 Nov");
    expect(formatted).not.toMatch(/^[A-Za-z]{3} \d/);
  });
});

describe("formatSupportDate", () => {
  it("keeps the full Dhaka date with a 12-hour clock", () => {
    // 06:41 UTC = 12:41 Dhaka (noon hour).
    expect(formatSupportDate("2026-11-02T06:41:00.000Z")).toBe("2 Nov 2026, 12:41 PM");
    // 15:46 UTC = 21:46 Dhaka.
    expect(formatSupportDate("2026-11-19T15:46:00.000Z")).toBe("19 Nov 2026, 9:46 PM");
    // 03:07 UTC = 09:07 Dhaka: no leading zero.
    expect(formatSupportDate("2026-11-19T03:07:00.000Z")).toBe("19 Nov 2026, 9:07 AM");
  });

  it("reads midnight as 12 AM on the Dhaka calendar day", () => {
    // 18:05 UTC on the 2nd = 00:05 Dhaka on the 3rd.
    expect(formatSupportDate("2026-11-02T18:05:00.000Z")).toBe("3 Nov 2026, 12:05 AM");
  });

  it("falls back to a readable placeholder", () => {
    expect(formatSupportDate(null)).toBe("Not available");
    expect(formatSupportDate("nope")).toBe("Not available");
  });
});
