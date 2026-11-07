import { describe, expect, it } from "vitest";

import {
  SEARCH_MAX_QUERY_LENGTH,
  SEARCH_MAX_TOKENS,
  buildIssuePublicSearchText,
  buildIssueSearchText,
  buildIssueSearchTextWithReplies,
  buildIssueStaffSearchText,
  buildSearchRegex,
  buildSearchTokens,
  escapeRegex,
  isSearchableStaffReply,
  joinSearchText,
  normalizeSearchQuery,
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

  it("includes the student name but not email (for privacy)", () => {
    const text = buildIssueSearchText(supportIssue);

    expect(text).toContain("rahim uddin");
    expect(text).not.toContain("rahim@example.com");
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

describe("query normalization", () => {
  it("caps an oversized query with the service-side limit", () => {
    const query = normalizeSearchQuery("a".repeat(SEARCH_MAX_QUERY_LENGTH + 50));
    expect(query).toHaveLength(SEARCH_MAX_QUERY_LENGTH);
  });

  it("lowercases, collapses whitespace and strips zero-width characters", () => {
    expect(normalizeSearchQuery("  React\u200B   API\tLOOP  ")).toBe("react api loop");
  });

  it("splits a query into bounded tokens", () => {
    const tokens = buildSearchTokens(Array.from({ length: 20 }, (_, i) => `word${i}`).join(" "));
    expect(tokens).toHaveLength(SEARCH_MAX_TOKENS);
    expect(tokens[0]).toBe("word0");
  });

  it("returns no tokens for an empty query", () => {
    expect(buildSearchTokens("   ")).toEqual([]);
  });
});

describe("scoped search text", () => {
  const source = {
    title: "React image not rendering",
    question: "Image not displaying after upload",
    studentName: "Rahim Uddin",
    batchNo: 12,
    courseSlug: "react-beginner",
    moduleSlug: "assets",
    contentSlug: "images-lecture",
    tags: ["react", "image"],
    videoLinks: [
      {
        title: "Lecture walkthrough",
        summary: "Uploads in detail",
        url: "https://youtu.be/HydrationDemo42",
        timestamp: "01:20",
      },
    ],
    uploads: [{ originalName: "rahim-passport.png" }],
  };

  const replies = [
    { body: "Move the file into the public folder", isStaffReply: true },
    { body: "I moved it but it still fails", isStaffReply: false },
  ];

  it("public text keeps issue content and staff answers", () => {
    const text = buildIssuePublicSearchText(source, replies);

    expect(text).toContain("react image not rendering");
    expect(text).toContain("react-beginner");
    expect(text).toContain("images-lecture");
    expect(text).toContain("batch 12");
    expect(text).toContain("lecture walkthrough");
    // The link itself is searchable: a YouTube ID from the URL finds it.
    expect(text).toContain("youtu.be/hydrationdemo42");
    expect(text).toContain("01:20");
    expect(text).toContain("move the file into the public folder");
  });

  it("public text never leaks identity or attachment metadata", () => {
    const text = buildIssuePublicSearchText(source, replies);

    expect(text).not.toContain("rahim");
    expect(text).not.toContain("passport");
    // A student's own words are private until a staff answer quotes them.
    expect(text).not.toContain("i moved it but it still fails");
  });

  it("public text falls back to the author role for legacy replies", () => {
    const text = buildIssuePublicSearchText(source, [
      { body: "legacy staff answer", authorRole: "ADMIN" },
      { body: "legacy student words", authorRole: "STUDENT" },
    ]);

    expect(text).toContain("legacy staff answer");
    expect(text).not.toContain("legacy student words");
  });

  it("an explicit isStaffReply wins over the author role", () => {
    expect(
      isSearchableStaffReply({ body: "x", isStaffReply: false, authorRole: "ADMIN" }),
    ).toBe(false);
    expect(
      isSearchableStaffReply({ body: "x", isStaffReply: true, authorRole: "STUDENT" }),
    ).toBe(true);
    expect(isSearchableStaffReply({ body: "x", authorRole: "MENTOR" })).toBe(true);
    expect(isSearchableStaffReply({ body: "x", authorRole: "STUDENT" })).toBe(false);
  });

  it("staff text adds identity, batch and attachment names plus every reply", () => {
    const text = buildIssueStaffSearchText(source, replies);

    expect(text).toContain("rahim uddin");
    expect(text).toContain("batch 12");
    expect(text).toContain("rahim-passport.png");
    expect(text).toContain("move the file into the public folder");
    expect(text).toContain("i moved it but it still fails");
  });

  it("both scopes rebuild from source instead of appending stale text", () => {
    expect(buildIssuePublicSearchText(source, [])).not.toContain("public folder");
    expect(buildIssueStaffSearchText(source, [])).not.toContain("public folder");
  });

  it("tolerates missing optional data", () => {
    const minimal = { title: "Only a title", question: "Only a question" };
    expect(buildIssuePublicSearchText(minimal, [])).toBe("only a title only a question");
    expect(buildIssueStaffSearchText(minimal, [])).toBe("only a title only a question");
  });
});