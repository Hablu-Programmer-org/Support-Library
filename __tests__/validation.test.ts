import { describe, expect, it } from "vitest";

import {
  externalFileLinkSchema,
  supportIssueInputSchema,
  supportReplyInputSchema,
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

    expect(parsed.isInternalNote).toBe(false);
    expect(parsed.fileLinks).toHaveLength(1);
    expect(parsed.videoLinks).toHaveLength(1);
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