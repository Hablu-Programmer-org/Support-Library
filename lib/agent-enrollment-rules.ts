/**
 * AI-tools access (n8n / OpenAI) is limited to the `agent` course.
 *
 * Kept dependency-free so the rule can be unit-tested without a database and
 * imported from both the LMS reader and the request queue.
 */

export const ACCESS_COURSE_SLUG = "agent";

export type LmsAgentEnrollment = {
  enrolled: boolean;
  batchNo: number | null;
  enrollmentId: string | null;
  /** `true` when the row is paused, revoked or soft-deleted. */
  blocked: boolean;
};

export const MISSING_AGENT_ENROLLMENT: LmsAgentEnrollment = {
  enrolled: false,
  batchNo: null,
  enrollmentId: null,
  blocked: true,
};

/** Enrolment states that still grant access. Anything unknown fails closed. */
const ALLOWED_STATUSES = new Set(["running", "completed"]);

export function isAllowedEnrollmentStatus(status: unknown) {
  return typeof status === "string" && ALLOWED_STATUSES.has(status.trim().toLowerCase());
}

/** Whether the student may receive (or be emailed) AI-tools access right now. */
export function agentEnrollmentAllows(agent: LmsAgentEnrollment | null | undefined) {
  if (!agent) return false;
  return agent.enrolled && !agent.blocked && typeof agent.batchNo === "number" && agent.batchNo > 0;
}

/** Minimal shape the LMS reader hands to the selector. */
export type LmsEnrollmentCandidate = {
  enrollmentId: string | null;
  batchNo: number | null;
  status: string | null;
};

/**
 * Picks the enrolment to trust when a student has several `agent` rows.
 *
 * A running row always beats a completed one, and both beat a paused/revoked
 * one; inside the same priority the highest batch wins. This stops a revoked
 * batch 4 from hiding an active batch 3.
 */
export function selectAgentEnrollment(
  rows: readonly LmsEnrollmentCandidate[],
): LmsAgentEnrollment {
  if (rows.length === 0) return MISSING_AGENT_ENROLLMENT;

  const rank = (row: LmsEnrollmentCandidate) => {
    const status = typeof row.status === "string" ? row.status.trim().toLowerCase() : "";
    if (status === "running") return 2;
    if (status === "completed") return 1;
    return 0;
  };

  const best = rows.reduce((current, row) => {
    const diff = rank(row) - rank(current);
    if (diff > 0) return row;
    if (diff < 0) return current;
    return (row.batchNo ?? 0) > (current.batchNo ?? 0) ? row : current;
  });

  const allowed = isAllowedEnrollmentStatus(best.status);

  return {
    enrolled: true,
    batchNo: best.batchNo,
    enrollmentId: best.enrollmentId,
    blocked: !allowed,
  };
}