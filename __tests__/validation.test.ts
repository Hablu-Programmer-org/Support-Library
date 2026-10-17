import { afterEach, describe, expect, it } from "vitest";

import {
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

  it("accepts replies with external video links", () => {
    const parsed = supportReplyInputSchema.parse({
      issueId: objectId,
      body: "Use the public folder and start the src with a slash.",
      videoLinks: [{ title: "Walkthrough", url: "https://youtu.be/demo", timestamp: "01:20" }],
    });

    expect(parsed.videoLinks).toHaveLength(1);
  });

  it("accepts issue-level video links and defaults them to empty", () => {
    const withLinks = supportIssueInputSchema.parse({
      studentName: "Rahim Uddin",
      studentEmail: "rahim@example.com",
      title: "React image problem",
      question: "Image show hocche na in React component",
      videoLinks: [{ title: "Walkthrough", url: "https://youtu.be/demo", timestamp: "01:20" }],
    });

    expect(withLinks.videoLinks).toHaveLength(1);

    const withoutLinks = supportIssueInputSchema.parse({
      studentName: "Rahim Uddin",
      studentEmail: "rahim@example.com",
      title: "React image problem",
      question: "Image show hocche na in React component",
    });

    expect(withoutLinks.videoLinks).toEqual([]);
  });

  it("rejects the removed fileLinks field", () => {
    expect(() =>
      supportIssueInputSchema.parse({
        studentName: "Rahim Uddin",
        studentEmail: "rahim@example.com",
        title: "React image problem",
        question: "Image show hocche na in React component",
        fileLinks: [{ title: "Old", url: "https://example.com/error.png" }],
      }),
    ).toThrow();

    expect(() =>
      supportReplyInputSchema.parse({
        issueId: objectId,
        body: "Old client payload",
        fileLinks: [],
      }),
    ).toThrow();
  });

  it("rejects the removed internal-note field", () => {
    expect(() =>
      supportReplyInputSchema.parse({
        issueId: objectId,
        body: "Staff only",
        isInternalNote: true,
        videoLinks: [],
      }),
    ).toThrow();
  });

  it("enforces HTTPS video links by default", () => {
    expect(() => videoLinksSchema.parse([{ title: "Bad", url: "http://example.com/video" }])).toThrow();
    expect(() => videoLinksSchema.parse([{ title: "JS", url: "javascript:alert(1)" }])).toThrow();
  });
});

describe("MAX_LINKS_PER_ITEM", () => {
  const original = process.env.MAX_LINKS_PER_ITEM;

  afterEach(() => {
    if (original === undefined) delete process.env.MAX_LINKS_PER_ITEM;
    else process.env.MAX_LINKS_PER_ITEM = original;
  });

  const videoLinks = (count: number) =>
    Array.from({ length: count }, (_, i) => ({ title: `Video ${i}`, url: `https://youtu.be/${i}` }));

  it("applies the default cap of 10 when the env var is unset", () => {
    delete process.env.MAX_LINKS_PER_ITEM;

    expect(videoLinksSchema.parse(videoLinks(10))).toHaveLength(10);
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
        videoLinks: links,
      });

    expect(issue(videoLinks(2)).videoLinks).toHaveLength(2);
    expect(() => issue(videoLinks(3))).toThrow(/at most 2 video links/i);
  });

  it("falls back to 10 for an out-of-range or non-numeric value", () => {
    for (const value of ["", "0", "-5", "ten", "9999"]) {
      process.env.MAX_LINKS_PER_ITEM = value;
      expect(videoLinksSchema.parse(videoLinks(10))).toHaveLength(10);
      expect(() => videoLinksSchema.parse(videoLinks(11))).toThrow();
    }
  });
});
