import { describe, expect, it } from "vitest";

import { lastStaffReplyDate, pickSolutionReplyId, replyAnchorId } from "@/lib/issue-solution";

const staff = (id: string, at = "2026-11-08T06:00:00Z") => ({ id, isStaffReply: true, createdAt: new Date(at) });
const student = (id: string, at = "2026-11-08T07:00:00Z") => ({ id, isStaffReply: false, createdAt: new Date(at) });

describe("pickSolutionReplyId", () => {
  it("picks the last staff reply on a solved case", () => {
    expect(pickSolutionReplyId("SOLVED", [staff("a"), student("b"), staff("c"), student("d")])).toBe("c");
  });

  it("falls back to the first reply when no staff reply exists", () => {
    expect(pickSolutionReplyId("SOLVED", [student("a"), student("b")])).toBe("a");
  });

  it("has no solution for an unsolved case or an empty thread", () => {
    expect(pickSolutionReplyId("OPEN", [staff("a")])).toBeUndefined();
    expect(pickSolutionReplyId("SOLVED", [])).toBeUndefined();
  });
});

describe("lastStaffReplyDate", () => {
  it("returns the newest staff reply date, ignoring student replies", () => {
    const date = lastStaffReplyDate([
      staff("a", "2026-11-07T10:00:00Z"),
      staff("b", "2026-11-08T06:12:00Z"),
      student("c", "2026-11-09T00:00:00Z"),
    ]);
    expect(date?.toISOString()).toBe("2026-11-08T06:12:00.000Z");
  });

  it("is null without a staff reply", () => {
    expect(lastStaffReplyDate([student("a")])).toBeNull();
  });
});

describe("replyAnchorId", () => {
  it("matches the id ReplyItem renders", () => {
    expect(replyAnchorId("r3")).toBe("reply-r3");
  });
});
