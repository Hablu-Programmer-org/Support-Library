import { describe, expect, it } from "vitest";

import { formatSupportDate, formatSupportShortDate } from "@/lib/format-date";

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
  it("keeps the full Dhaka date and time format", () => {
    expect(formatSupportDate("2026-11-02T06:41:00.000Z")).toBe("2 Nov 2026, 12:41");
  });

  it("falls back to a readable placeholder", () => {
    expect(formatSupportDate(null)).toBe("Not available");
    expect(formatSupportDate("nope")).toBe("Not available");
  });
});
