import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { buildIssueFilter } from "@/lib/services/issues";

/**
 * The Mongo (regex-engine) filter shape: staff match the staff text only,
 * students never touch `caseRef`, and the public legacy branches keep
 * pre-backfill rows searchable for issue-level fields (including the numeric
 * batch and video-link fields).
 */
describe("buildIssueFilter", () => {
  const orOf = (params: Parameters<typeof buildIssueFilter>[0], publicOnly: boolean) =>
    buildIssueFilter(params, publicOnly).$or as Array<Record<string, unknown>>;

  it("matches staff search against the staff text only", () => {
    const branches = orOf({ q: "hydration" }, false);

    expect(branches).toEqual([{ searchText: { $regex: "hydration", $options: "i" } }]);
  });

  it("keeps a six-digit staff case reference as an exact branch", () => {
    const branches = orOf({ q: "123456" }, false);

    expect(branches).toContainEqual({ caseRef: "123456" });
    expect(branches).toContainEqual({
      searchText: { $regex: "123456", $options: "i" },
    });
  });

  it("never adds a case reference branch for students", () => {
    const branches = orOf({ q: "123456" }, true);

    expect(branches.every((branch) => !("caseRef" in branch))).toBe(true);
    expect(branches.some((branch) => "publicSearchText" in branch)).toBe(true);
  });

  it("keeps legacy issue/video-link branches for pre-backfill public rows", () => {
    const branches = orOf({ q: "walkthrough" }, true);
    const fields = branches.map((branch) => Object.keys(branch)[0]);

    expect(fields).toContain("publicSearchText");
    expect(fields).toContain("title");
    expect(fields).toContain("question");
    expect(fields).toContain("tags");
    expect(fields).toContain("videoLinks.title");
    expect(fields).toContain("videoLinks.summary");
    expect(fields).toContain("videoLinks.url");
    expect(fields).toContain("videoLinks.timestamp");
    // No staff-only field may appear in a public filter.
    expect(fields).not.toContain("searchText");
    expect(fields).not.toContain("studentName");
  });

  it("matches the numeric batch field for a bare number or a Batch label", () => {
    expect(orOf({ q: "12" }, true)).toContainEqual({ batchNo: 12 });
    expect(orOf({ q: "batch 12" }, true)).toContainEqual({ batchNo: 12 });
    expect(orOf({ q: "image" }, true).some((branch) => "batchNo" in branch)).toBe(false);
  });

  it("lowercases the tag filter to match stored tags", () => {
    expect(buildIssueFilter({ tag: "Video" }).tags).toBe("video");
  });

  it("pins the regex engine to the whole normalized phrase", () => {
    // `buildSearchRegex` lowercases through normalization and escapes
    // metacharacters, so the phrase — not the token list — is the query.
    const branches = orOf({ q: "Hydration mismatch a.b" }, true);
    const textBranch = branches.find((branch) => "publicSearchText" in branch);

    expect(textBranch).toEqual({
      publicSearchText: { $regex: "hydration mismatch a\\.b", $options: "i" },
    });
  });

  it("produces no free-text filter for a one-character query", () => {
    expect(buildIssueFilter({ q: "a" }).$or).toBeUndefined();
  });
});
