export const CASE_STATUSES = ["OPEN", "SOLVED", "PENDING", "FOLLOW_UP", "ARCHIVED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export const ISSUE_VISIBILITIES = ["INTERNAL", "PUBLISHED"] as const;
export type IssueVisibility = (typeof ISSUE_VISIBILITIES)[number];

export const USER_ROLES = ["ADMIN", "MENTOR", "STUDENT"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/**
 * Statuses that still justify taking a request to the live room.
 *
 * A solved or archived request no longer opens the room: the student has to
 * submit a fresh one, which is the whole point of the gate.
 */
export const LIVE_SUPPORT_ELIGIBLE_STATUSES = ["OPEN", "PENDING", "FOLLOW_UP"] as const;
export type LiveSupportStatus = (typeof LIVE_SUPPORT_ELIGIBLE_STATUSES)[number];
