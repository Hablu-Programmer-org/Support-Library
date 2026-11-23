import { describe, expect, it } from "vitest";

import {
  createSupportIssueInputSchema,
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

  it("allows a general issue with no student identity", () => {
    const parsed = supportIssueInputSchema.parse({
      title: "General React image problem",
      question: "Image show hocche na in React component",
    });

    expect(parsed.studentName).toBeUndefined();
    expect(parsed.studentEmail).toBeUndefined();
  });

  it("accepts optional course metadata for a general issue", () => {
    const parsed = supportIssueInputSchema.parse({
      title: "General React image problem",
      question: "Image show hocche na in React component",
      courseSlug: "react-beginner",
      batchNo: "2",
      moduleSlug: "assets",
      contentSlug: "images-lecture",
      tags: ["React", "image"],
    });

    expect(parsed.batchNo).toBe(2);
    expect(parsed.tags).toEqual(["react", "image"]);
  });

  it("rejects a partial student identity", () => {
    expect(() =>
      supportIssueInputSchema.parse({
        studentName: "Rahim Uddin",
        title: "React image problem",
        question: "Image show hocche na in React component",
      }),
    ).toThrow(/both student name and email/i);

    expect(() =>
      supportIssueInputSchema.parse({
        studentEmail: "rahim@example.com",
        title: "React image problem",
        question: "Image show hocche na in React component",
      }),
    ).toThrow(/both student name and email/i);
  });

  it("rejects an LMS user id without a student email", () => {
    expect(() =>
      supportIssueInputSchema.parse({
        lmsUserId: "lms-123",
        title: "React image problem",
        question: "Image show hocche na in React component",
      }),
    ).toThrow(/requires a student identity/i);
  });

  it("caps a new issue title at 80 characters on one line", () => {
    const base = {
      question: "Image show hocche na in the React component after deployment",
    };

    expect(
      createSupportIssueInputSchema.parse({
        ...base,
        title: "a".repeat(80),
      }).title,
    ).toHaveLength(80);

    expect(() =>
      createSupportIssueInputSchema.parse({
        ...base,
        title: "a".repeat(81),
      }),
    ).toThrow(/80 characters/i);

    expect(() =>
      createSupportIssueInputSchema.parse({
        ...base,
        title: "Assignment Submission\nlink missing",
      }),
    ).toThrow(/one line/i);
  });

  it("requires 40 normalized detail characters only when creating", () => {
    const validQuestion = "The production page returns a 404 after I submit the assignment.";

    expect(
      createSupportIssueInputSchema.parse({
        title: "Assignment submission returns 404",
        question: validQuestion,
      }).question,
    ).toBe(validQuestion);

    expect(() =>
      createSupportIssueInputSchema.parse({
        title: "Assignment submission returns 404",
        question: "The page is broken after submit.",
      }),
    ).toThrow(/at least 40 characters/i);

    expect(() =>
      createSupportIssueInputSchema.parse({
        title: "Assignment submission returns 404",
        question: "Two words" + " \n ".repeat(30),
      }),
    ).toThrow(/at least 40 characters/i);

    // Legacy rows written under the old rule remain editable.
    expect(
      supportIssueInputSchema.parse({
        title: "Legacy short issue",
        question: "Short",
      }).question,
    ).toBe("Short");
  });

  it("never counts the 'Use template' headings towards the 40 characters", () => {
    const title = "Assignment submission returns 404";
    const headings = "## কী করতে চাচ্ছিলাম\n\n## কী হলো\n\n## কী try করেছি";
    // The headings alone are longer than 40 characters.
    expect(headings.replace(/\s+/g, " ").length).toBeGreaterThan(40);

    expect(() => createSupportIssueInputSchema.parse({ title, question: headings })).toThrow(
      /নিজের ভাষায় সমস্যাটা লিখুন/,
    );
    expect(() =>
      createSupportIssueInputSchema.parse({
        title,
        question: "## কী করতে চাচ্ছিলাম\n\nSubmit\n\n## কী হলো\n\n404\n\n## কী try করেছি",
      }),
    ).toThrow(/at least 40 characters/i);
    expect(
      createSupportIssueInputSchema.parse({
        title,
        question: "## কী করতে চাচ্ছিলাম\n\nSubmit the module 5 assignment link.\n\n## কী হলো\n\nThe page returns 404.",
      }).question,
    ).toContain("404");
  });

  it("keeps the wider title limit when editing a legacy issue", () => {
    expect(
      supportIssueInputSchema.parse({
        title: "a".repeat(200),
        question: "Image show hocche na in React component",
      }).title,
    ).toHaveLength(200);
  });

  it("rejects the removed videoLinks field", () => {
    expect(() =>
      supportIssueInputSchema.parse({
        title: "React image problem",
        question: "Image show hocche na in React component",
        videoLinks: [{ title: "Walkthrough", url: "https://youtu.be/demo" }],
      }),
    ).toThrow();

    expect(() =>
      supportReplyInputSchema.parse({
        issueId: objectId,
        body: "Old client payload",
        videoLinks: [],
      }),
    ).toThrow();
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
      }),
    ).toThrow();
  });
});
