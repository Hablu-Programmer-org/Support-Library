import { afterEach, describe, expect, it } from "vitest";

import { parseFileLinks, parseVideoLinks } from "@/lib/parse-links";

describe("parseFileLinks", () => {
  it("returns an empty array when no value is provided", () => {
    expect(parseFileLinks(undefined)).toEqual([]);
    expect(parseFileLinks("")).toEqual([]);
    expect(parseFileLinks("   \n \n ")).toEqual([]);
  });

  it("treats a bare URL line as a link with a hostname title", () => {
    expect(parseFileLinks("https://example.com/fix.pdf")).toEqual([
      { title: "example.com", url: "https://example.com/fix.pdf" },
    ]);
  });

  it("prefixes https when the scheme is missing", () => {
    expect(parseFileLinks("example.com/fix.png")).toEqual([
      { title: "example.com", url: "https://example.com/fix.png" },
    ]);
    expect(parseFileLinks("www.example.com/fix.png")).toEqual([
      { title: "example.com", url: "https://www.example.com/fix.png" },
    ]);
  });

  it("preserves the title|url|type|note format", () => {
    expect(parseFileLinks("Guide|https://example.com/fix.png|image|Annotated screenshot")).toEqual([
      { title: "Guide", url: "https://example.com/fix.png", type: "image", note: "Annotated screenshot" },
    ]);
  });

  it("falls back to the hostname when the title is missing", () => {
    expect(parseFileLinks("|https://example.com/fix.pdf|pdf")).toEqual([
      { title: "example.com", url: "https://example.com/fix.pdf", type: "pdf" },
    ]);
  });

  it("drops non-URL lines and keeps valid ones", () => {
    expect(parseFileLinks("just a note\nftp://example.com/file\nhttps://example.com/ok.pdf")).toEqual([
      { title: "example.com", url: "https://example.com/ok.pdf" },
    ]);
  });

  it("truncates an oversized note to the schema limit", () => {
    const longNote = "x".repeat(301);
    expect(parseFileLinks(`Guide|https://example.com/a.pdf|pdf|${longNote}`)).toEqual([
      { title: "Guide", url: "https://example.com/a.pdf", type: "pdf", note: "x".repeat(300) },
    ]);
  });

  it("truncates an oversized title to the schema limit", () => {
    const longTitle = "t".repeat(200);
    const result = parseFileLinks(`${longTitle}|https://example.com/a.pdf`);
    expect(result[0].title).toHaveLength(120);
    expect(result[0].url).toBe("https://example.com/a.pdf");
  });

  it("caps at 10 links", () => {
    const lines = Array.from({ length: 12 }, (_, i) => `https://example.com/${i}.pdf`).join("\n");
    expect(parseFileLinks(lines)).toHaveLength(10);
  });
});

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

describe("MAX_LINKS_PER_ITEM", () => {
  const original = process.env.MAX_LINKS_PER_ITEM;

  afterEach(() => {
    if (original === undefined) delete process.env.MAX_LINKS_PER_ITEM;
    else process.env.MAX_LINKS_PER_ITEM = original;
  });

  const fileLines = (count: number) =>
    Array.from({ length: count }, (_, i) => `https://example.com/${i}.pdf`).join("\n");
  const videoLines = (count: number) =>
    Array.from({ length: count }, (_, i) => `https://youtu.be/${i}`).join("\n");

  it("lowers the cap for both attachment types", () => {
    process.env.MAX_LINKS_PER_ITEM = "3";
    expect(parseFileLinks(fileLines(12))).toHaveLength(3);
    expect(parseVideoLinks(videoLines(12))).toHaveLength(3);
  });

  it("raises the cap up to the hard ceiling of 50", () => {
    process.env.MAX_LINKS_PER_ITEM = "20";
    expect(parseFileLinks(fileLines(25))).toHaveLength(20);

    process.env.MAX_LINKS_PER_ITEM = "999";
    expect(parseFileLinks(fileLines(25))).toHaveLength(10);
  });

  it("falls back to 10 for an invalid override", () => {
    for (const value of ["", "0", "-1", "ten"]) {
      process.env.MAX_LINKS_PER_ITEM = value;
      expect(parseFileLinks(fileLines(12))).toHaveLength(10);
    }
  });
});