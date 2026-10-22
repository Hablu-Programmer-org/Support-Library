// @vitest-environment node
import mongoose from "mongoose";
import { describe, expect, it } from "vitest";

import { LIVE_SUPPORT_ELIGIBLE_STATUSES } from "@/lib/constants";
import { buildEligibleIssueFilter } from "@/lib/live-support-policy";

/**
 * Eligibility is the whole gate, so its query shape is pinned here: the actor is
 * always the authenticated student (never a form value), a deleted request is
 * never eligible, and only unresolved statuses open the room.
 */
describe("buildEligibleIssueFilter", () => {
  const studentId = "0000000000000000000000c3";

  it("always scopes to the authenticated student", () => {
    const filter = buildEligibleIssueFilter(studentId);

    expect(filter.createdBy).toBeInstanceOf(mongoose.Types.ObjectId);
    expect(String(filter.createdBy)).toBe(studentId);
  });

  it("never matches a soft-deleted request", () => {
    expect(buildEligibleIssueFilter(studentId).deletedAt).toBeNull();
  });

  it("only accepts unresolved statuses", () => {
    const filter = buildEligibleIssueFilter(studentId);

    expect(filter.status).toEqual({ $in: ["OPEN", "PENDING", "FOLLOW_UP"] });
    expect(filter.status.$in).toEqual([...LIVE_SUPPORT_ELIGIBLE_STATUSES]);
    // Solved or archived requests must never be offered in the room picker.
    expect(filter.status.$in).not.toContain("SOLVED");
    expect(filter.status.$in).not.toContain("ARCHIVED");
  });
});
