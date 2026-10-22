import { afterEach, describe, expect, it } from "vitest";

import { parseVideoLinks } from "@/lib/parse-links";
import { formatVideoLinks } from "@/lib/format-links";

describe("parseVideoLinks", () => {
  it("returns an empty array when no value is provided", () => {
    expect(parseVideoLinks(undefined)).toEqual([]);
  });

  it("treats a bare URL line as a video link", () => {
    expect(parseVideoLinks("https://youtu.be/demo")).toEqual([
      { title: "youtu.be", url: "https://youtu.be/demo" },
    ]);
  });

  it("preserves the title|url|timestamp|summary format", () => {
    expect(parseVideoLinks("Walkthrough|https://youtu.be/demo|01:20|Covers the fix")).toEqual([
      { title: "Walkthrough", url: "https://youtu.be/demo", timestamp: "01:20", summary: "Covers the fix" },
    ]);
  });

  it("drops an invalid timestamp but keeps the link", () => {
    expect(parseVideoLinks("Walkthrough|https://youtu.be/demo|01-20")).toEqual([
      { title: "Walkthrough", url: "https://youtu.be/demo" },
    ]);
  });

  it("truncates an oversized summary to the schema limit", () => {
    const longSummary = "x".repeat(501);
    expect(parseVideoLinks(`Walkthrough|https://youtu.be/demo|01:20|${longSummary}`)).toEqual([
      { title: "Walkthrough", url: "https://youtu.be/demo", timestamp: "01:20", summary: "x".repeat(500) },
    ]);
  });

  it("caps at 10 links", () => {
    const lines = Array.from({ length: 12 }, (_, i) => `https://youtu.be/${i}`).join("\n");
    expect(parseVideoLinks(lines)).toHaveLength(10);
  });
});

describe("formatVideoLinks", () => {
  it("renders nothing for an empty list", () => {
    expect(formatVideoLinks([])).toBe("");
    expect(formatVideoLinks(undefined)).toBe("");
  });

  it("drops trailing empty fields", () => {
    expect(formatVideoLinks([{ title: "Walkthrough", url: "https://youtu.be/demo" }])).toBe(
      "Walkthrough|https://youtu.be/demo",
    );
  });

  it("keeps timestamp and summary when present", () => {
    expect(
      formatVideoLinks([
        {
          title: "Walkthrough",
          url: "https://youtu.be/demo",
          timestamp: "01:20",
          summary: "Covers the fix",
        },
      ]),
    ).toBe("Walkthrough|https://youtu.be/demo|01:20|Covers the fix");
  });

  it("round-trips through the parser used by the forms", () => {
    const stored = [
      { title: "Walkthrough", url: "https://youtu.be/demo", timestamp: "01:20", summary: "Covers the fix" },
      { title: "Second", url: "https://youtu.be/second" },
    ];

    // The edit form shows `format` and posts the textarea back into `parse`; the
    // stored links must survive that loop unchanged.
    expect(parseVideoLinks(formatVideoLinks(stored))).toEqual(stored);
  });
});

describe("MAX_LINKS_PER_ITEM", () => {
  const original = process.env.MAX_LINKS_PER_ITEM;

  afterEach(() => {
    if (original === undefined) delete process.env.MAX_LINKS_PER_ITEM;
    else process.env.MAX_LINKS_PER_ITEM = original;
  });

  const videoLines = (count: number) =>
    Array.from({ length: count }, (_, i) => `https://youtu.be/${i}`).join("\n");

  it("lowers the video-link cap", () => {
    process.env.MAX_LINKS_PER_ITEM = "3";
    expect(parseVideoLinks(videoLines(12))).toHaveLength(3);
  });

  it("raises the cap up to the hard ceiling of 50", () => {
    process.env.MAX_LINKS_PER_ITEM = "20";
    expect(parseVideoLinks(videoLines(25))).toHaveLength(20);

    process.env.MAX_LINKS_PER_ITEM = "999";
    expect(parseVideoLinks(videoLines(25))).toHaveLength(10);
  });

  it("falls back to 10 for an invalid override", () => {
    for (const value of ["", "0", "-1", "ten"]) {
      process.env.MAX_LINKS_PER_ITEM = value;
      expect(parseVideoLinks(videoLines(12))).toHaveLength(10);
    }
  });
});
