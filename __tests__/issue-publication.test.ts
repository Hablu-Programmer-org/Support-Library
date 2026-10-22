import { describe, expect, it } from "vitest";

import { shouldPublishOnSolve } from "@/lib/issue-publication";

describe("shouldPublishOnSolve", () => {
  it("publishes only when an admin confirms the PII review while solving", () => {
    expect(shouldPublishOnSolve({ status: "SOLVED", role: "ADMIN", confirmed: true })).toBe(true);
  });

  it("never publishes without the confirmation", () => {
    expect(shouldPublishOnSolve({ status: "SOLVED", role: "ADMIN", confirmed: false })).toBe(false);
  });

  it("keeps publication admin-only", () => {
    expect(shouldPublishOnSolve({ status: "SOLVED", role: "MENTOR", confirmed: true })).toBe(false);
    expect(shouldPublishOnSolve({ status: "SOLVED", role: "STUDENT", confirmed: true })).toBe(false);
  });

  it("only auto-publishes for the SOLVED status", () => {
    for (const status of ["OPEN", "PENDING", "FOLLOW_UP", "ARCHIVED"] as const) {
      expect(shouldPublishOnSolve({ status, role: "ADMIN", confirmed: true })).toBe(false);
    }
  });
});
