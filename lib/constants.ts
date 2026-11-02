export const CASE_STATUSES = ["OPEN", "SOLVED", "PENDING", "FOLLOW_UP", "ARCHIVED"] as const;

/**
 * Title limits.
 *
 * A new issue's title must fit on one readable line and say what the problem
 * is, so creation is capped at 80 characters and rejects newlines. Existing
 * rows written under the old 200-character rule stay editable (and readable)
 * without a migration.
 */
export const ISSUE_TITLE_CREATE_MAX = 80;
export const ISSUE_TITLE_WARN_AT = 60;
export const ISSUE_TITLE_MAX = 200;
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
