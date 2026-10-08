import { describe, expect, it } from "vitest";

import {
  caseSolutionLinkInputSchema,
  externalFileLinkSchema,
  solutionArticleInputSchema,
  supportCaseInputSchema,
  supportReplyInputSchema,
} from "@/lib/validation";

const objectId = "507f1f77bcf86cd799439011";

describe("product validation", () => {
  it("normalizes the case student email and rejects unknown keys", () => {
    expect(
      supportCaseInputSchema.parse({
        studentName: "Rahim Uddin",
        studentEmail: " RAHIM@example.COM ",
        title: "React image problem",
        question: "Image show hocche na in React component",
      }).studentEmail,
    ).toBe("rahim@example.com");

    expect(() =>
      supportCaseInputSchema.parse({
        studentName: "Rahim",
        studentEmail: "rahim@example.com",
        role: "ADMIN",
      }),
    ).toThrow();
  });

  it("defaults case status/priority and normalizes unique tags", () => {
    const parsed = supportCaseInputSchema.parse({
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
      supportCaseInputSchema.parse({
        studentName: "Rahim Uddin",
        studentEmail: "not-an-email",
        title: "React image problem",
        question: "Image show hocche na in React component",
      }),
    ).toThrow();
  });

  it("accepts replies with external file/video links", () => {
    const parsed = supportReplyInputSchema.parse({
      caseId: objectId,
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

  it("defaults solution visibility to INTERNAL", () => {
    const parsed = solutionArticleInputSchema.parse({
      title: "React useEffect loop fix",
      summary: "Dependency array issue causes loop.",
      body: "Move unstable object/function dependencies out of render or memoize where needed.",
      tags: ["react", "useeffect"],
    });

    expect(parsed.visibility).toBe("INTERNAL");
  });

  it("validates the separate case-solution link input", () => {
    expect(
      caseSolutionLinkInputSchema.parse({
        caseId: objectId,
        solutionArticleId: "507f191e810c19729de860ea",
      }),
    ).toEqual({ caseId: objectId, solutionArticleId: "507f191e810c19729de860ea" });
  });
});
