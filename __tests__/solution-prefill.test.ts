import { describe, expect, it } from "vitest";

import { buildSolutionPrefill } from "@/lib/solution-prefill";

describe("buildSolutionPrefill", () => {
  it("prefixes the title and keeps it within the field limit", () => {
    const prefill = buildSolutionPrefill({ title: "মেনু বাগ", question: "প্রশ্ন" });
    expect(prefill.title).toBe("Fix: মেনু বাগ");
    expect(prefill.title.length).toBeLessThanOrEqual(200);
  });

  it("collapses whitespace in the summary and caps it at 500 chars", () => {
    const prefill = buildSolutionPrefill({ title: "T", question: `  a\n\n  b   ${"c".repeat(600)}  ` });
    expect(prefill.summary).not.toContain("\n");
    expect(prefill.summary.length).toBe(500);
    expect(prefill.summary.startsWith("a b ccc")).toBe(true);
  });

  it("seeds the body with the problem and an empty steps scaffold", () => {
    const prefill = buildSolutionPrefill({ title: "T", question: "  Blank screen  " });
    // clip() trims, so the steps scaffold has no trailing space.
    expect(prefill.body).toBe("## Problem\nBlank screen\n\n## Steps\n1.");
  });

  it("adds the latest reply as the suggested fix", () => {
    const prefill = buildSolutionPrefill({
      title: "T",
      question: "Blank screen",
      replyBody: "  Wrap the provider  ",
    });
    expect(prefill.body).toBe(
      "## Problem\nBlank screen\n\n## Suggested fix\nWrap the provider\n\n## Steps\n1.",
    );
  });

  it("omits the suggested fix section when there is no public reply", () => {
    const prefill = buildSolutionPrefill({ title: "T", question: "Q", replyBody: "   " });
    expect(prefill.body).not.toContain("Suggested fix");
  });

  it("joins case tags into the comma separated field", () => {
    expect(buildSolutionPrefill({ title: "T", question: "Q", tags: ["react", "next"] }).tags).toBe(
      "react, next",
    );
    expect(buildSolutionPrefill({ title: "T", question: "Q", tags: null }).tags).toBe("");
  });
});