import { describe, expect, it } from "vitest";

import {
  buildIssueSearchText,
  buildIssueSearchTextWithReplies,
  buildSearchRegex,
  escapeRegex,
  joinSearchText,
  normalizeText,
} from "@/lib/search";

describe("search utilities", () => {
  it("normalizes whitespace, casing and zero-width chars", () => {
    expect(normalizeText("  React\u200B   API LOOP  ")).toBe("react api loop");
  });

  it("normalizes multiword search queries", () => {
    expect(normalizeText(" Image   not displaying ")).toBe("image not displaying");
  });

  it("escapes regex metacharacters", () => {
    expect(escapeRegex("useEffect(api) [loop]")).toBe("useEffect\\(api\\) \\[loop\\]");
  });

  it("joins mixed search fields", () => {
    expect(joinSearchText(["React", null, "image", 12])).toBe("react image 12");
  });

  it("does not build regex for one-character queries", () => {
    expect(buildSearchRegex("a")).toBeNull();
  });
});

describe("issue search text", () => {
  const supportIssue = {
    title: "React image not rendering",
    question: "Image not displaying",
    studentName: "Rahim Uddin",
    studentEmail: "rahim@example.com",
    courseSlug: "react-beginner",
    moduleSlug: "assets",
    contentSlug: "images-lecture",
    tags: ["react", "image"],
  };

  it("includes the student name and email", () => {
    const text = buildIssueSearchText(supportIssue);

    expect(text).toContain("rahim uddin");
    expect(text).toContain("rahim@example.com");
  });

  it("includes course, module and content slugs", () => {
    const text = buildIssueSearchText(supportIssue);

    expect(text).toContain("react-beginner");
    expect(text).toContain("assets");
    expect(text).toContain("images-lecture");
  });

  it("normalizes and lowercases every field", () => {
    expect(buildIssueSearchText({ ...supportIssue, title: "  React\u200B IMAGE  " })).toContain(
      "react image",
    );
  });

  it("tolerates null slugs and tags", () => {
    expect(
      buildIssueSearchText({
        title: "No slugs",
        question: "Body",
        courseSlug: null,
        moduleSlug: null,
        contentSlug: null,
        tags: null,
      }),
    ).toBe("no slugs body");
  });

  // Regression: the reply refresh used to append to the stored value using an
  // aggregation pipeline that only concatenated title/question/tags, which dropped
  // courseSlug/moduleSlug/contentSlug as soon as any reply existed.
  it("keeps slugs when public replies are appended", () => {
    const text = buildIssueSearchTextWithReplies(supportIssue, [
      "Place the file inside the public folder",
    ]);

    expect(text).toContain("react-beginner");
    expect(text).toContain("assets");
    expect(text).toContain("images-lecture");
    expect(text).toContain("public folder");
  });

  // Regression: stale reply text used to survive because refresh was skipped when
  // no public reply body remained.
  it("drops reply text but keeps slugs when the last reply is removed", () => {
    const withReply = buildIssueSearchTextWithReplies(supportIssue, ["temporary answer"]);
    const withoutReply = buildIssueSearchTextWithReplies(supportIssue, []);

    expect(withReply).toContain("temporary answer");
    expect(withoutReply).not.toContain("temporary answer");
    expect(withoutReply).toBe(buildIssueSearchText(supportIssue));
  });
});