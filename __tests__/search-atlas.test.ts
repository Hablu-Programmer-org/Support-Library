import { afterEach, describe, expect, it, vi } from "vitest";

import { SEARCH_MAX_QUERY_LENGTH } from "@/lib/search";
import {
  ATLAS_PUBLIC_INDEX,
  ATLAS_STAFF_INDEX,
  ATLAS_WILDCARD_MAX_LENGTH,
  buildAtlasSearchStage,
  escapeWildcard,
  isAtlasEligibleQuery,
  resolveSearchEngine,
} from "@/lib/search-atlas";

type StageResult = ReturnType<typeof buildAtlasSearchStage>;

/** Narrow the compound body without leaking `any` into the assertions. */
function compoundOf(result: StageResult) {
  return result.$search.compound as {
    should: Record<string, unknown>[];
    filter?: Record<string, unknown>[];
    minimumShouldMatch: number;
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("buildAtlasSearchStage", () => {
  it("routes the public scope to the public index and public text field", () => {
    const compound = compoundOf(buildAtlasSearchStage({ query: "image", scope: "public" }));

    expect(buildAtlasSearchStage({ query: "image", scope: "public" }).$search.index).toBe(
      ATLAS_PUBLIC_INDEX,
    );
    const serialized = JSON.stringify(compound);
    expect(serialized).toContain("publicSearchText");
    // The staff-only field and identity fields must not appear at all.
    expect(serialized).not.toContain('"searchText"');
    expect(serialized).not.toContain("studentName");
  });

  it("routes the staff scope to the staff index and staff text field", () => {
    const stage = buildAtlasSearchStage({ query: "image", scope: "staff" });
    const serialized = JSON.stringify(compoundOf(stage));

    expect(stage.$search.index).toBe(ATLAS_STAFF_INDEX);
    expect(serialized).toContain('"searchText"');
    expect(serialized).not.toContain("publicSearchText");
  });

  it("restricts the public scope to published rows", () => {
    const compound = compoundOf(buildAtlasSearchStage({ query: "image", scope: "public" }));

    expect(compound.filter).toContainEqual({
      equals: { path: "visibility", value: "PUBLISHED" },
    });
    expect(
      compoundOf(buildAtlasSearchStage({ query: "image", scope: "staff" })).filter,
    ).toBeUndefined();
  });

  it("passes structured filters through", () => {
    const compound = compoundOf(
      buildAtlasSearchStage({
        query: "image",
        scope: "staff",
        filters: {
          status: "OPEN",
          courseSlug: "react-beginner",
          batchNo: 7,
          tag: "Video",
        },
      }),
    );

    expect(compound.filter).toEqual([
      { equals: { path: "status", value: "OPEN" } },
      { equals: { path: "courseSlug", value: "react-beginner" } },
      { equals: { path: "batchNo", value: 7 } },
      // Tags are stored lowercase, so the Atlas `equals` must lowercase too.
      { in: { path: "tags", value: ["video"] } },
    ]);
  });

  it("adds the infix wildcard clause for a short query", () => {
    const compound = compoundOf(buildAtlasSearchStage({ query: "hydra", scope: "public" }));

    expect(compound.should).toContainEqual({
      wildcard: {
        query: "*hydra*",
        path: "publicSearchText.raw",
        allowAnalyzedField: false,
      },
    });
  });

  const longQuery = "a".repeat(ATLAS_WILDCARD_MAX_LENGTH + 1);
  it.runIf(longQuery.length <= SEARCH_MAX_QUERY_LENGTH)(
    "omits the wildcard clause for a very long query",
    () => {
      const compound = compoundOf(buildAtlasSearchStage({ query: longQuery, scope: "staff" }));

      expect(compound.should.some((clause) => "wildcard" in clause)).toBe(false);
    },
  );

  it("escapes wildcard operators in the infix clause", () => {
    expect(escapeWildcard("a*b?c\\d")).toBe("a\\*b\\?c\\\\d");

    const compound = compoundOf(buildAtlasSearchStage({ query: "a*b", scope: "staff" }));
    const wildcard = compound.should.find((clause) => "wildcard" in clause);
    expect(wildcard).toEqual({
      wildcard: {
        query: "*a\\*b*",
        path: "searchText.raw",
        allowAnalyzedField: false,
      },
    });
  });

  it("always requires one scoring clause", () => {
    expect(
      compoundOf(buildAtlasSearchStage({ query: "image", scope: "public" })).minimumShouldMatch,
    ).toBe(1);
  });
});

describe("resolveSearchEngine", () => {
  it("defaults to regex on a local database", () => {
    vi.stubEnv("SEARCH_ENGINE", "");
    expect(resolveSearchEngine("mongodb://127.0.0.1:27017/?replicaSet=rs0")).toBe("regex");
    expect(resolveSearchEngine("mongodb://localhost:27017/hablu")).toBe("regex");
  });

  it("defaults to Atlas on a remote database", () => {
    vi.stubEnv("SEARCH_ENGINE", "");
    expect(
      resolveSearchEngine("mongodb+srv://user:pass@lms.example.mongodb.net/?retryWrites=true"),
    ).toBe("atlas");
  });

  it("honours an explicit engine override", () => {
    vi.stubEnv("SEARCH_ENGINE", "regex");
    expect(resolveSearchEngine("mongodb+srv://user:pass@lms.example.mongodb.net")).toBe("regex");

    vi.stubEnv("SEARCH_ENGINE", "atlas");
    expect(resolveSearchEngine("mongodb://127.0.0.1:27017")).toBe("atlas");
  });

  it("ignores an unknown value and falls back to auto", () => {
    vi.stubEnv("SEARCH_ENGINE", "elastic");
    expect(resolveSearchEngine("mongodb://127.0.0.1:27017")).toBe("regex");
  });
});

describe("isAtlasEligibleQuery", () => {
  it("rejects a query that is too short", () => {
    expect(isAtlasEligibleQuery("a", false)).toBe(false);
    expect(isAtlasEligibleQuery("  ", false)).toBe(false);
  });

  it("rejects an e-mail address", () => {
    expect(isAtlasEligibleQuery("rahim@example.com", false)).toBe(false);
    expect(isAtlasEligibleQuery("rahim@example.com", true)).toBe(false);
  });

  it("rejects a six-digit case reference for staff only", () => {
    expect(isAtlasEligibleQuery("123456", false)).toBe(false);
    expect(isAtlasEligibleQuery("123456", true)).toBe(true);
  });

  it("accepts ordinary text queries", () => {
    expect(isAtlasEligibleQuery("image not rendering", false)).toBe(true);
    expect(isAtlasEligibleQuery("image not rendering", true)).toBe(true);
  });
});
