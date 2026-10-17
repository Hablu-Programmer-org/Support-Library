import { USER_ROLES, type UserRole } from "@/lib/constants";

export { USER_ROLES };
export type { UserRole };

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Admin",
  MENTOR: "Mentor",
  STUDENT: "Student",
};

export const ROLE_RANK: Record<UserRole, number> = {
  ADMIN: 3,
  MENTOR: 2,
  STUDENT: 1,
};

export const hasRole = (userRole: UserRole, required: UserRole) =>
  ROLE_RANK[userRole] >= ROLE_RANK[required];

export const isAdmin = (role: UserRole) => role === "ADMIN";

/**
 * Staff mutation rights: editing issues, replying, archiving and publishing.
 *
 * Students must never satisfy this, because the same predicate also decides
 * whether unpublished (internal) issues and student PII are readable.
 */
export const canMutate = (role: UserRole) => role === "ADMIN" || role === "MENTOR";

/**
 * Who may submit a new support issue.
 *
 * Every signed-in LMS account qualifies, so a student can raise a request while
 * `canMutate` keeps their rights limited to that single action.
 */
export const canCreateIssue = (role?: UserRole | null): boolean =>
  Boolean(role && hasRole(role, "STUDENT"));
