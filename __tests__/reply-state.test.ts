import { describe, expect, it } from "vitest";

import { deriveIssueReplyState } from "@/lib/reply-state";

describe("deriveIssueReplyState", () => {
  const older = new Date("2026-01-01T00:00:00.000Z");
  const newer = new Date("2026-01-02T00:00:00.000Z");

  it("requires an answer when there has never been a staff reply", () => {
    expect(deriveIssueReplyState(null, null).awaitingStaff).toBe(true);
    expect(deriveIssueReplyState(null, older).awaitingStaff).toBe(true);
  });

  it("waits for the student after the latest staff reply", () => {
    expect(deriveIssueReplyState(newer, older).awaitingStaff).toBe(false);
  });

  it("returns to the staff queue when the student replies later", () => {
    expect(deriveIssueReplyState(older, newer).awaitingStaff).toBe(true);
  });

  it("does not treat equal timestamps as a later student reply", () => {
    expect(deriveIssueReplyState(older, older).awaitingStaff).toBe(false);
  });
});
