import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { relevanceRankStage } from "@/lib/services/issues";

/**
 * The regex engine's "Best match" ordering. Atlas scores with `$searchScore`;
 * the fallback only needs a title/question-weighted rank before pagination.
 */
describe("relevanceRankStage", () => {
  it("weights title, then question, then the denormalized text", () => {
    const stage = JSON.stringify(relevanceRankStage("hydration", true));

    expect(stage).toContain("relevanceRank");
    expect(stage).toContain('"$title"');
    expect(stage).toContain('"$question"');
    // A public relevance match may only look in the public text.
    expect(stage).toContain('"$publicSearchText"');
    expect(stage).not.toContain('"$searchText"');
    expect(stage).toContain("$cond");
    expect(stage).toContain("$regexMatch");
  });

  it("matches the staff scope against the staff text", () => {
    const stage = JSON.stringify(relevanceRankStage("hydration", false));

    expect(stage).toContain('"$searchText"');
    expect(stage).not.toContain('"$publicSearchText"');
  });

  it("takes the normalized query and escapes it internally", () => {
    const stage = relevanceRankStage("a.b?", false) as {
      $addFields: {
        relevanceRank: {
          $add: Array<{ $cond: [Record<string, unknown>, number, number] }>;
        };
      };
    };

    for (const cond of stage.$addFields.relevanceRank.$add) {
      const regexMatch = cond.$cond[0].$regexMatch as {
        regex: string;
        options: string;
      };
      expect(regexMatch.regex).toBe("a\\.b\\?");
      expect(regexMatch.options).toBe("i");
    }
  });
});
