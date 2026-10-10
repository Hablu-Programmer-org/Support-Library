export const CASE_STATUSES = ["OPEN", "SOLVED", "PENDING", "FOLLOW_UP", "ARCHIVED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const CASE_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
export type CasePriority = (typeof CASE_PRIORITIES)[number];

export const USER_ROLES = ["ADMIN", "MENTOR", "VIEWER"] as const;
export type UserRole = (typeof USER_ROLES)[number];