import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { ISSUE_ANSWER_SORT_STAGES } from "@/lib/services/issues";

/**
 * The staff queue must show "needs an answer" first (oldest request first) and
 * keep a stable tiebreaker. Legacy rows have no `awaitingStaff` field at all, so
 * the rank expression must treat "missing" as awaiting instead of burying the
 * oldest unanswered ticket at the bottom before the backfill has run.
 */
describe("ISSUE_ANSWER_SORT_STAGES", () => {
  const [rankStage, sortStage] = ISSUE_ANSWER_SORT_STAGES;

  it("ranks anything that is not explicitly answered as awaiting", () => {
    const rank = JSON.stringify(rankStage);
    expect(rank).toContain('"$eq":["$awaitingStaff",false]');
    expect(rank).toContain('"$cond"');
    // Only an explicit `false` (answered, waiting for the student) ranks lower.
    expect(rankStage.$addFields).toHaveProperty("awaitingStaffRank");
  });

  it("puts awaiting first, then oldest, then a stable id tiebreaker", () => {
    expect(sortStage).toEqual({
      $sort: { awaitingStaffRank: -1, createdAt: 1, _id: 1 },
    });
  });
});
