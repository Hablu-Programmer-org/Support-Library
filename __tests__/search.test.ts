import { describe, expect, it } from "vitest";

import { buildSearchRegex, escapeRegex, joinSearchText, normalizeText } from "@/lib/search";

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
