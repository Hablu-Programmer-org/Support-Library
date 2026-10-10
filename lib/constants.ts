export const CASE_STATUSES = ["OPEN", "SOLVED", "PENDING", "FOLLOW_UP", "ARCHIVED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export const ISSUE_VISIBILITIES = ["INTERNAL", "PUBLISHED"] as const;
export type IssueVisibility = (typeof ISSUE_VISIBILITIES)[number];

export const USER_ROLES = ["ADMIN", "MENTOR", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];
