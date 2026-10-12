import type { UserRole } from "@/models/User";

/**
 * hp-v2 roles that map to local ADMIN (full staff access).
 */
const ADMIN_LMS_ROLES = new Set([
  "SUPER_ADMIN",
  "ADMIN",
  "MANAGER",
  "COORDINATOR",
  "MODERATOR",
]);

/**
 * hp-v2 roles that map to local MENTOR (staff, no admin panel).
 *
 * Only teaching/staff roles are elevated. `MEMBER` is a regular account holder
 * in hp-v2 (not staff), so it intentionally falls through to VIEWER — elevating
 * it would grant any learner staff access and student PII.
 */
const MENTOR_LMS_ROLES = new Set(["INSTRUCTOR"]);

/**
 * Maps a hp-v2 `User.role` onto the local three-tier role.
 *
 * hp-v2 holds real user accounts for everyone — staff and students alike —
 * and the collection contains a few rows with inconsistent casing (`Student`,
 * `user`), so the comparison is case-insensitive. Anything unrecognized (or
 * a student role) lands on VIEWER: read-only, no mutations.
 */
export const mapLmsRole = (lmsRole?: string | null): UserRole => {
  const normalized = (lmsRole ?? "").trim().toUpperCase();
  if (ADMIN_LMS_ROLES.has(normalized)) return "ADMIN";
  if (MENTOR_LMS_ROLES.has(normalized)) return "MENTOR";
  return "VIEWER";
};
