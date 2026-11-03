import { afterEach, describe, expect, it } from "vitest";

import { parseStudentVideoLinks, parseStudentVideoLinksResult } from "@/lib/parse-links";

describe("parseStudentVideoLinksResult", () => {
  afterEach(() => {
    delete process.env.MAX_LINKS_PER_ITEM;
  });

  it("accepts a valid single link", () => {
    const result = parseStudentVideoLinksResult("Walkthrough|https://youtu.be/demo|01:20|Covers the fix");
    expect(result.invalidLines).toEqual([]);
    expect(result.overflow).toBe(false);
    expect(result.links).toEqual([
      { title: "Walkthrough", url: "https://youtu.be/demo", timestamp: "01:20", summary: "Covers the fix" },
    ]);
  });

  it("rejects an invalid timestamp instead of dropping it", () => {
    const result = parseStudentVideoLinksResult("Walkthrough|https://youtu.be/demo|01-20");
    expect(result.links).toEqual([]);
    expect(result.invalidLines).toHaveLength(1);
  });

  it("rejects a timestamp longer than 12 characters", () => {
    const result = parseStudentVideoLinksResult("Walkthrough|https://youtu.be/demo|1234567890123");
    expect(result.links).toEqual([]);
    expect(result.invalidLines).toHaveLength(1);
  });

  it("rejects a title longer than 120 characters", () => {
    const longTitle = "x".repeat(121);
    const result = parseStudentVideoLinksResult(`${longTitle}|https://youtu.be/demo`);
    expect(result.links).toEqual([]);
    expect(result.invalidLines).toHaveLength(1);
  });

  it("rejects a summary longer than 500 characters", () => {
    const longSummary = "x".repeat(501);
    const result = parseStudentVideoLinksResult(`Walkthrough|https://youtu.be/demo|01:20|${longSummary}`);
    expect(result.links).toEqual([]);
    expect(result.invalidLines).toHaveLength(1);
  });

  it("rejects more than four pipe fields", () => {
    const result = parseStudentVideoLinksResult("a|https://youtu.be/demo|01:20|s|extra");
    expect(result.links).toEqual([]);
    expect(result.invalidLines).toHaveLength(1);
  });

  it("rejects a non-https url", () => {
    const result = parseStudentVideoLinksResult("Walkthrough|http://youtu.be/demo");
    expect(result.links).toEqual([]);
    expect(result.invalidLines).toHaveLength(1);
  });

  it("rejects overflow beyond the configured limit", () => {
    process.env.MAX_LINKS_PER_ITEM = "2";
    const lines = Array.from({ length: 3 }, (_, i) => `https://youtu.be/${i}`).join("\n");
    const result = parseStudentVideoLinksResult(lines);
    expect(result.links).toEqual([]);
    expect(result.overflow).toBe(true);
  });

  it("returns empty from the convenience wrapper on any invalid line", () => {
    expect(parseStudentVideoLinks("Walkthrough|https://youtu.be/demo|01-20")).toEqual([]);
  });

  it("rejects a malformed timestamp with consecutive colons", () => {
    const result = parseStudentVideoLinksResult("Walkthrough|https://youtu.be/demo|01::20");
    expect(result.links).toEqual([]);
    expect(result.invalidLines).toHaveLength(1);
  });
});
