import { afterEach, describe, expect, it } from "vitest";

import {
  externalFileLinkSchema,
  fileLinksSchema,
  supportIssueInputSchema,
  supportReplyInputSchema,
  videoLinksSchema,
} from "@/lib/validation";

const objectId = "507f1f77bcf86cd799439011";

describe("product validation", () => {
  it("normalizes the issue student email and rejects unknown keys", () => {
    expect(
      supportIssueInputSchema.parse({
        studentName: "Rahim Uddin",
        studentEmail: " RAHIM@example.COM ",
        title: "React image problem",
        question: "Image show hocche na in React component",
      }).studentEmail,
    ).toBe("rahim@example.com");

    expect(() =>
      supportIssueInputSchema.parse({
        studentName: "Rahim",
        studentEmail: "rahim@example.com",
        role: "ADMIN",
      }),
    ).toThrow();
  });

  it("defaults issue status/priority and normalizes unique tags", () => {
    const parsed = supportIssueInputSchema.parse({
      studentName: "Rahim Uddin",
      studentEmail: "rahim@example.com",
      title: "React image problem",
      question: "Image show hocche na in React component",
      tags: ["React", "react", "next.js"],
    });

    expect(parsed.status).toBe("OPEN");
    expect(parsed.priority).toBe("NORMAL");
    expect(parsed.tags).toEqual(["react", "next.js"]);
  });

  it("rejects a missing student email", () => {
    expect(() =>
      supportIssueInputSchema.parse({
        studentName: "Rahim Uddin",
        studentEmail: "not-an-email",
        title: "React image problem",
        question: "Image show hocche na in React component",
      }),
    ).toThrow();
  });

  it("accepts replies with external file/video links", () => {
    const parsed = supportReplyInputSchema.parse({
      issueId: objectId,
      body: "Use the public folder and start the src with a slash.",
      fileLinks: [{ title: "Screenshot", url: "https://example.com/screenshot.png" }],
      videoLinks: [{ title: "Walkthrough", url: "https://youtu.be/demo", timestamp: "01:20" }],
    });

    expect(parsed.fileLinks).toHaveLength(1);
    expect(parsed.videoLinks).toHaveLength(1);
  });

  it("accepts issue-level attachment links and defaults them to empty", () => {
    const withLinks = supportIssueInputSchema.parse({
      studentName: "Rahim Uddin",
      studentEmail: "rahim@example.com",
      title: "React image problem",
      question: "Image show hocche na in React component",
      fileLinks: [
        { title: "Screenshot", url: "https://example.com/error.png", type: "image" },
      ],
      videoLinks: [{ title: "Walkthrough", url: "https://youtu.be/demo", timestamp: "01:20" }],
    });

    expect(withLinks.fileLinks).toHaveLength(1);
    expect(withLinks.videoLinks).toHaveLength(1);

    const withoutLinks = supportIssueInputSchema.parse({
      studentName: "Rahim Uddin",
      studentEmail: "rahim@example.com",
      title: "React image problem",
      question: "Image show hocche na in React component",
    });

    expect(withoutLinks.fileLinks).toEqual([]);
    expect(withoutLinks.videoLinks).toEqual([]);
  });

  it("rejects insecure issue-level attachment links", () => {
    expect(() =>
      supportIssueInputSchema.parse({
        studentName: "Rahim Uddin",
        studentEmail: "rahim@example.com",
        title: "React image problem",
        question: "Image show hocche na in React component",
        fileLinks: [{ title: "Bad", url: "http://example.com/error.png" }],
      }),
    ).toThrow();
  });

  it("rejects the removed internal-note field", () => {
    expect(() =>
      supportReplyInputSchema.parse({
        issueId: objectId,
        body: "Staff only",
        isInternalNote: true,
        fileLinks: [],
        videoLinks: [],
      }),
    ).toThrow();
  });

  it("enforces HTTPS links by default", () => {
    expect(() =>
      externalFileLinkSchema.parse({ title: "Bad", url: "http://example.com/file.png" }),
    ).toThrow();
    expect(() =>
      externalFileLinkSchema.parse({ title: "JS", url: "javascript:alert(1)" }),
    ).toThrow();
  });
});

describe("MAX_LINKS_PER_ITEM", () => {
  const original = process.env.MAX_LINKS_PER_ITEM;

  afterEach(() => {
    if (original === undefined) delete process.env.MAX_LINKS_PER_ITEM;
    else process.env.MAX_LINKS_PER_ITEM = original;
  });

  const fileLinks = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      title: `File ${i}`,
      url: `https://example.com/${i}.png`,
    }));
  const videoLinks = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ title: `Video ${i}`, url: `https://youtu.be/${i}` }));

  it("applies the default cap of 10 when the env var is unset", () => {
    delete process.env.MAX_LINKS_PER_ITEM;

    expect(fileLinksSchema.parse(fileLinks(10))).toHaveLength(10);
    expect(videoLinksSchema.parse(videoLinks(10))).toHaveLength(10);
    expect(() => fileLinksSchema.parse(fileLinks(11))).toThrow(/at most 10 file links/i);
    expect(() => videoLinksSchema.parse(videoLinks(11))).toThrow(/at most 10 video links/i);
  });

  it("honours a lowered cap through the issue schema", () => {
    process.env.MAX_LINKS_PER_ITEM = "2";

    const issue = (links: { title: string; url: string }[]) =>
      supportIssueInputSchema.parse({
        studentName: "Rahim Uddin",
        studentEmail: "rahim@example.com",
        title: "React image problem",
        question: "Image show hocche na in React component",
        fileLinks: links,
      });

    expect(issue(fileLinks(2)).fileLinks).toHaveLength(2);
    expect(() => issue(fileLinks(3))).toThrow(/at most 2 file links/i);
  });

  it("falls back to 10 for an out-of-range or non-numeric value", () => {
    for (const value of ["", "0", "-5", "ten", "9999"]) {
      process.env.MAX_LINKS_PER_ITEM = value;
      expect(fileLinksSchema.parse(fileLinks(10))).toHaveLength(10);
      expect(() => fileLinksSchema.parse(fileLinks(11))).toThrow();
    }
  });
});
