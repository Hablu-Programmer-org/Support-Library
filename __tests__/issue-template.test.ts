import { describe, expect, it } from "vitest";

import {
  issueDetailsCharacterCount,
  issueDetailsMinimumProblem,
  isTemplateOnlyIssueDetails,
} from "@/lib/issue-content-rules";
import {
  hasTemplateHeadings,
  issueTemplateMarkdown,
  ISSUE_TEMPLATE_SECTIONS,
  templateHintFor,
  withoutEmptyTemplateSections,
  withoutTemplateHeadings,
} from "@/lib/issue-template";

const filled = [
  "## কী করতে চাচ্ছিলাম",
  "",
  "Module 5-এর assignment submit করতে চাচ্ছিলাম।",
  "",
  "## কী হলো",
  "",
  "Submit button চাপলে 404 আসে।",
  "",
  "## কী try করেছি",
  "",
  "Browser cache clear করেছি।",
].join("\n");

describe("issueTemplateMarkdown", () => {
  it("is the three spec headings (spec example)", () => {
    expect(issueTemplateMarkdown).toBe("## কী করতে চাচ্ছিলাম\n\n## কী হলো\n\n## কী try করেছি");
    expect(ISSUE_TEMPLATE_SECTIONS.every(({ hint }) => hint.length > 0)).toBe(true);
    expect(templateHintFor(" কী হলো ")).toMatch(/error/);
    expect(templateHintFor("Something else")).toBeUndefined();
  });
});

describe("template headings never count", () => {
  it("detects template headings at any level, but not inside code or as prose", () => {
    expect(hasTemplateHeadings(issueTemplateMarkdown)).toBe(true);
    expect(hasTemplateHeadings("### কী হলো ##")).toBe(true);
    expect(hasTemplateHeadings("কী হলো")).toBe(false);
    expect(hasTemplateHeadings("## কী হলো তারপর")).toBe(false);
    expect(hasTemplateHeadings("```md\n## কী হলো\n```")).toBe(false);
  });

  it("removes only the template heading lines", () => {
    expect(withoutTemplateHeadings(filled)).toBe(
      "\nModule 5-এর assignment submit করতে চাচ্ছিলাম।\n\n\nSubmit button চাপলে 404 আসে।\n\n\nBrowser cache clear করেছি।",
    );
  });

  it("counts zero for the bare template, although its headings exceed 40 characters", () => {
    expect(issueTemplateMarkdown.replace(/\s+/g, " ").length).toBeGreaterThan(40);
    expect(issueDetailsCharacterCount(issueTemplateMarkdown)).toBe(0);
    expect(isTemplateOnlyIssueDetails(issueTemplateMarkdown)).toBe(true);
    expect(issueDetailsMinimumProblem(issueTemplateMarkdown)).toBe("template-only");
  });

  it("reports too-short for the template with a few words, and passes when filled", () => {
    expect(issueDetailsMinimumProblem("## কী করতে চাচ্ছিলাম\n\nSubmit\n\n## কী হলো\n\n404")).toBe("too-short");
    expect(issueDetailsMinimumProblem(filled)).toBeNull();
  });

  it("is not template-only when there are no template headings", () => {
    expect(isTemplateOnlyIssueDetails("")).toBe(false);
    expect(issueDetailsMinimumProblem("")).toBe("too-short");
  });
});

describe("withoutEmptyTemplateSections", () => {
  it("drops sections left empty and keeps filled ones as written", () => {
    const partly = "## কী করতে চাচ্ছিলাম\n\nSubmit the assignment.\n\n\n\n## কী হলো\n\n\n\n## কী try করেছি";
    expect(withoutEmptyTemplateSections(partly)).toBe("## কী করতে চাচ্ছিলাম\n\nSubmit the assignment.");
    expect(withoutEmptyTemplateSections(filled)).toBe(filled);
  });

  it("returns an empty string for the bare template", () => {
    expect(withoutEmptyTemplateSections("## কী করতে চাচ্ছিলাম\n\n\n\n## কী হলো\n\n\n\n## কী try করেছি")).toBe("");
  });

  it("keeps a section whose content is a code block with blank lines inside", () => {
    const code = "## কী হলো\n\n```js\nconst a = 1;\n\n\n\nconst b = 2;\n```\n\n## কী try করেছি";
    expect(withoutEmptyTemplateSections(code)).toBe("## কী হলো\n\n```js\nconst a = 1;\n\n\n\nconst b = 2;\n```");
  });

  it("stops a section at the student's own heading", () => {
    expect(withoutEmptyTemplateSections("## কী হলো\n\n## My notes\n\nSome text")).toBe("## My notes\n\nSome text");
  });

  it("leaves text without template headings untouched", () => {
    expect(withoutEmptyTemplateSections("  plain text\n\n\n\nmore  ")).toBe("plain text\n\n\n\nmore");
  });
});
