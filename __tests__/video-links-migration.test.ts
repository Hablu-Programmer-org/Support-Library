import { describe, expect, it } from "vitest";

import { parseRichText } from "@/lib/rich-text";
import {
  formatVideoLinkLine,
  planVideoLinksFold,
  VIDEO_LINKS_HEADING,
} from "@/lib/video-links-migration";

describe("formatVideoLinkLine", () => {
  it("writes a Markdown link with timestamp and summary", () => {
    expect(
      formatVideoLinkLine({
        title: "Lecture 5",
        url: "https://youtu.be/abc",
        timestamp: "12:30",
        summary: "Covers the fix",
      }),
    ).toBe("- [Lecture 5](https://youtu.be/abc) — 12:30 · Covers the fix");
  });

  it("omits empty optional fields", () => {
    expect(formatVideoLinkLine({ title: "Intro", url: "https://a.dev/v", timestamp: null, summary: "" })).toBe(
      "- [Intro](https://a.dev/v)",
    );
  });

  it("softens brackets in the title so the link still parses", () => {
    const line = formatVideoLinkLine({ title: "[Part 1] setup", url: "https://a.dev/v" });
    expect(line).toBe("- [(Part 1) setup](https://a.dev/v)");
  });

  it("writes a URL containing ')' bare after the title", () => {
    expect(formatVideoLinkLine({ title: "Wiki", url: "https://en.wikipedia.org/wiki/A_(b)" })).toBe(
      "- Wiki: https://en.wikipedia.org/wiki/A_(b)",
    );
  });

  it("collapses newlines into one line", () => {
    expect(formatVideoLinkLine({ title: "A\nB", url: "https://a.dev", summary: "x\n\ny" })).toBe(
      "- [A B](https://a.dev) — x y",
    );
  });

  it("rejects non-http URLs", () => {
    expect(formatVideoLinkLine({ title: "x", url: "javascript:alert(1)" })).toBeNull();
    expect(formatVideoLinkLine({ title: "x", url: "not a url" })).toBeNull();
    expect(formatVideoLinkLine({ title: "x" })).toBeNull();
  });
});

describe("planVideoLinksFold", () => {
  const link = { title: "Lecture", url: "https://youtu.be/abc" };

  it("only unsets an empty or missing array", () => {
    expect(planVideoLinksFold("Body", [])).toEqual({ kind: "unset-only", droppedLinks: 0 });
    expect(planVideoLinksFold("Body", undefined)).toEqual({ kind: "unset-only", droppedLinks: 0 });
  });

  it("unsets without touching text when every link is invalid", () => {
    expect(planVideoLinksFold("Body", [{ title: "x", url: "ftp://a" }])).toEqual({
      kind: "unset-only",
      droppedLinks: 1,
    });
  });

  it("appends a heading and list after the existing text", () => {
    const plan = planVideoLinksFold("The problem\n\n", [link, { title: "bad", url: "data:x" }]);
    expect(plan).toEqual({
      kind: "fold",
      text: `The problem\n\n${VIDEO_LINKS_HEADING}\n\n- [Lecture](https://youtu.be/abc)`,
      appended: `${VIDEO_LINKS_HEADING}\n\n- [Lecture](https://youtu.be/abc)`,
      links: 1,
      droppedLinks: 1,
    });
  });

  it("uses the list alone when the text is empty", () => {
    const plan = planVideoLinksFold("", [link]);
    expect(plan.kind === "fold" && plan.text).toBe(`${VIDEO_LINKS_HEADING}\n\n- [Lecture](https://youtu.be/abc)`);
  });

  it("refuses to exceed the text limit", () => {
    const plan = planVideoLinksFold("x".repeat(95), [link], 100);
    expect(plan.kind).toBe("too-long");
  });

  it("is a no-op input for a second run (output carries no videoLinks)", () => {
    const plan = planVideoLinksFold("Body", [link]);
    if (plan.kind !== "fold") throw new Error("expected fold");
    expect(planVideoLinksFold(plan.text, undefined)).toEqual({ kind: "unset-only", droppedLinks: 0 });
  });

  it("renders as a clickable link through RichText", () => {
    const plan = planVideoLinksFold("Body", [link]);
    if (plan.kind !== "fold") throw new Error("expected fold");
    const rendered = JSON.stringify(parseRichText(plan.text));
    expect(rendered).toContain("https://youtu.be/abc");
  });
});
