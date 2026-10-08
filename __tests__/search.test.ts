import { describe, expect, it } from "vitest";

import {
  buildCaseSearchText,
  buildCaseSearchTextWithReplies,
  buildSearchRegex,
  escapeRegex,
  joinSearchText,
  normalizeText,
} from "@/lib/search";

describe("search utilities", () => {
  it("normalizes whitespace, casing and zero-width chars", () => {
    expect(normalizeText("  React\u200B   API LOOP  ")).toBe("react api loop");
  });

  it("keeps Bangla text searchable", () => {
    expect(normalizeText(" ছবি   দেখাচ্ছে না ")).toBe("ছবি দেখাচ্ছে না");
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

describe("case search text", () => {
  const supportCase = {
    title: "React image not rendering",
    question: "ছবি দেখাচ্ছে না",
    studentName: "রহিম উদ্দিন",
    studentEmail: "rahim@example.com",
    courseSlug: "react-beginner",
    moduleSlug: "assets",
    contentSlug: "images-lecture",
    tags: ["react", "image"],
  };

  it("includes the student name and email", () => {
    const text = buildCaseSearchText(supportCase);

    expect(text).toContain("রহিম উদ্দিন");
    expect(text).toContain("rahim@example.com");
  });

  it("includes course, module and content slugs", () => {
    const text = buildCaseSearchText(supportCase);

    expect(text).toContain("react-beginner");
    expect(text).toContain("assets");
    expect(text).toContain("images-lecture");
  });

  it("normalizes and lowercases every field", () => {
    expect(buildCaseSearchText({ ...supportCase, title: "  React\u200B IMAGE  " })).toContain(
      "react image",
    );
  });

  it("tolerates null slugs and tags", () => {
    expect(
      buildCaseSearchText({
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
    const text = buildCaseSearchTextWithReplies(supportCase, [
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
    const withReply = buildCaseSearchTextWithReplies(supportCase, ["temporary answer"]);
    const withoutReply = buildCaseSearchTextWithReplies(supportCase, []);

    expect(withReply).toContain("temporary answer");
    expect(withoutReply).not.toContain("temporary answer");
    expect(withoutReply).toBe(buildCaseSearchText(supportCase));
  });
});
