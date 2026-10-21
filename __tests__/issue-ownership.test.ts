// @vitest-environment node
import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

import { buildOwnIssueFilter } from "@/lib/issue-ownership";

/**
 * The owner view is the only place a student can read an unpublished case, so
 * its scope is pinned here: always the authenticated student, never the id in
 * the URL alone, and never a soft-deleted request.
 */
describe("buildOwnIssueFilter", () => {
  const studentId = "0000000000000000000000c3";

  it("always scopes to the authenticated student", () => {
    const filter = buildOwnIssueFilter(studentId);

    expect(filter.createdBy).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(filter.createdBy)).toBe(studentId);
  });

  it("never matches a soft-deleted request", () => {
    expect(buildOwnIssueFilter(studentId).deletedAt).toBeNull();
  });
});
