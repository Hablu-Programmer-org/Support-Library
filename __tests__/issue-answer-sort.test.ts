import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ISSUE_ANSWER_SORT_STAGES } from "@/lib/services/issues";

/**
 * The staff queue derives legacy state before pagination, ranks unresolved work
 * ahead of completed work and keeps a stable newest-first tiebreaker.
 */
describe("ISSUE_ANSWER_SORT_STAGES", () => {
  it("derives missing reply state before sorting", () => {
    const pipeline = JSON.stringify(ISSUE_ANSWER_SORT_STAGES);
    expect(pipeline).toContain('"from":"support-replies"');
    expect(pipeline).toContain('"needsLegacyState"');
    expect(pipeline).toContain('"effectiveAwaitingStaff"');
  });

  it("puts actionable unresolved first and solved/archived last", () => {
    const pipeline = JSON.stringify(ISSUE_ANSWER_SORT_STAGES);
    expect(pipeline).toContain('"$in":["$status",["SOLVED","ARCHIVED"]]');
    expect(ISSUE_ANSWER_SORT_STAGES.at(-1)).toEqual({
      $sort: { answerQueueBucket: 1, answerQueueActivityAt: -1, createdAt: -1, _id: -1 },
    });
  });
});
