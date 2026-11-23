import { describe, expect, it } from "vitest";

import {
  isBrowsableTag,
  normalizeTag,
  parseTagList,
  planTagNormalization,
  popularTags,
} from "@/lib/issue-tags";

describe("normalizeTag", () => {
  it("drops a leading # and trailing punctuation, and lowercases", () => {
    expect(normalizeTag("#AI")).toBe("ai");
    expect(normalizeTag("aiagent.")).toBe("aiagent");
    expect(normalizeTag("  n8n,  ")).toBe("n8n");
    expect(normalizeTag("সমস্যা।")).toBe("সমস্যা");
  });

  it("keeps punctuation inside the tag", () => {
    expect(normalizeTag("node.js")).toBe("node.js");
    expect(normalizeTag("discord-link")).toBe("discord-link");
  });
});

describe("parseTagList", () => {
  it("splits, normalizes and de-duplicates the form value", () => {
    expect(parseTagList("#AI, ai, aiagent., , n8n")).toEqual(["ai", "aiagent", "n8n"]);
  });

  it("returns an empty list for no input", () => {
    expect(parseTagList(undefined)).toEqual([]);
    expect(parseTagList("")).toEqual([]);
  });
});

describe("planTagNormalization", () => {
  it("normalizes, merges duplicates and keeps first-seen order", () => {
    expect(planTagNormalization(["#AI", "aiagent.", "ai", "n8n"])).toEqual({
      next: ["ai", "aiagent", "n8n"],
      changed: true,
      dropped: 1,
    });
  });

  it("reports nothing to do for already-normalized tags (idempotent)", () => {
    const first = planTagNormalization(["Guide।", "how-to"]);
    expect(planTagNormalization(first.next)).toEqual({
      next: ["guide", "how-to"],
      changed: false,
      dropped: 0,
    });
  });

  it("drops empty and non-string entries", () => {
    expect(planTagNormalization(["#", " ", 5, null, "ok"])).toEqual({
      next: ["ok"],
      changed: true,
      dropped: 4,
    });
  });

  it("treats a missing or invalid field as an empty list to write", () => {
    expect(planTagNormalization(undefined)).toEqual({ next: [], changed: true, dropped: 0 });
    expect(planTagNormalization([])).toEqual({ next: [], changed: false, dropped: 0 });
  });
});

describe("isBrowsableTag", () => {
  it("rejects bare numbers and single characters", () => {
    expect(isBrowsableTag("1")).toBe(false);
    expect(isBrowsableTag("#12")).toBe(false);
    expect(isBrowsableTag("a")).toBe(false);
    expect(isBrowsableTag("ai")).toBe(true);
    expect(isBrowsableTag("n8n")).toBe(true);
  });
});

describe("popularTags", () => {
  it("orders by use, merges variants and hides noise", () => {
    const result = popularTags(
      [
        { tag: "1", count: 40 },
        { tag: "guide", count: 3 },
        { tag: "aiagent.", count: 2 },
        { tag: "aiagent", count: 5 },
        { tag: "google", count: 3 },
      ],
      8,
    );
    expect(result).toEqual([
      { tag: "aiagent", label: "aiagent", count: 7 },
      { tag: "google", label: "google", count: 3 },
      { tag: "guide", label: "guide", count: 3 },
    ]);
  });

  it("links a merged tag to the variant most issues carry", () => {
    const [top] = popularTags(
      [
        { tag: "aiagent.", count: 9 },
        { tag: "aiagent", count: 1 },
      ],
      8,
    );
    expect(top).toEqual({ tag: "aiagent.", label: "aiagent", count: 10 });
  });

  it("respects the limit", () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({ tag: `tag${i}`, count: i }));
    expect(popularTags(rows, 8)).toHaveLength(8);
  });
});
