import { describe, expect, it } from "vitest";

import {
  ACCESS_COURSE_SLUG,
  agentEnrollmentAllows,
  isAllowedEnrollmentStatus,
  selectAgentEnrollment,
  type LmsAgentEnrollment,
  type LmsEnrollmentCandidate,
} from "@/lib/agent-enrollment-rules";

const enrolled: LmsAgentEnrollment = {
  enrolled: true,
  batchNo: 4,
  enrollmentId: "65f0000000000000000000aa",
  blocked: false,
};

const row = (
  batchNo: number,
  status: string | null,
  enrollmentId = `id-${batchNo}`,
): LmsEnrollmentCandidate => ({ batchNo, status, enrollmentId });

describe("agentEnrollmentAllows", () => {
  it("pins the fixed course slug", () => {
    expect(ACCESS_COURSE_SLUG).toBe("agent");
  });

  it("allows an active agent enrolment with a batch", () => {
    expect(agentEnrollmentAllows(enrolled)).toBe(true);
  });

  it("denies a student who is not in the agent course", () => {
    expect(
      agentEnrollmentAllows({ enrolled: false, batchNo: null, enrollmentId: null, blocked: true }),
    ).toBe(false);
    expect(agentEnrollmentAllows(null)).toBe(false);
    expect(agentEnrollmentAllows(undefined)).toBe(false);
  });

  it("denies a paused, revoked or deleted enrolment", () => {
    expect(agentEnrollmentAllows({ ...enrolled, blocked: true })).toBe(false);
  });

  it("denies a missing or invalid batch", () => {
    expect(agentEnrollmentAllows({ ...enrolled, batchNo: null })).toBe(false);
    expect(agentEnrollmentAllows({ ...enrolled, batchNo: 0 })).toBe(false);
  });
});

describe("isAllowedEnrollmentStatus", () => {
  it("accepts running and completed only", () => {
    expect(isAllowedEnrollmentStatus("running")).toBe(true);
    expect(isAllowedEnrollmentStatus("COMPLETED")).toBe(true);
    expect(isAllowedEnrollmentStatus("paused")).toBe(false);
    expect(isAllowedEnrollmentStatus("revoked")).toBe(false);
    expect(isAllowedEnrollmentStatus("deleted")).toBe(false);
    expect(isAllowedEnrollmentStatus("")).toBe(false);
    expect(isAllowedEnrollmentStatus(null)).toBe(false);
    expect(isAllowedEnrollmentStatus(undefined)).toBe(false);
  });
});

describe("selectAgentEnrollment", () => {
  it("fails closed when the student has no agent row", () => {
    expect(selectAgentEnrollment([])).toEqual({
      enrolled: false,
      batchNo: null,
      enrollmentId: null,
      blocked: true,
    });
  });

  it("picks the highest running batch", () => {
    const picked = selectAgentEnrollment([row(2, "running"), row(5, "running"), row(4, "running")]);
    expect(picked).toMatchObject({ enrolled: true, batchNo: 5, blocked: false });
  });

  it("prefers a running row over a higher revoked one", () => {
    const picked = selectAgentEnrollment([row(4, "revoked"), row(3, "running")]);
    expect(picked).toMatchObject({ batchNo: 3, blocked: false });
  });

  it("prefers a completed row over a higher paused one", () => {
    const picked = selectAgentEnrollment([row(6, "paused"), row(4, "completed")]);
    expect(picked).toMatchObject({ batchNo: 4, blocked: false });
  });

  it("blocks when every row is inactive", () => {
    const picked = selectAgentEnrollment([row(4, "revoked"), row(2, "paused")]);
    expect(picked.enrolled).toBe(true);
    expect(picked.blocked).toBe(true);
  });

  it("blocks an unknown status instead of assuming it is fine", () => {
    expect(selectAgentEnrollment([row(4, null)]).blocked).toBe(true);
    expect(selectAgentEnrollment([row(4, "pending-approval")]).blocked).toBe(true);
    const nullStatus = selectAgentEnrollment([row(4, "running")]);
    expect(agentEnrollmentAllows(nullStatus)).toBe(true);
  });
});
