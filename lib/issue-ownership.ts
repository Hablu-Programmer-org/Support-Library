import mongoose from "mongoose";

/**
 * Ownership scope for a student reading their own request.
 *
 * A student's own case is resolved by `createdBy` (the authenticated actor),
 * never by the id in the URL alone. It lives in a pure module so the detail
 * page, the list page and a unit test share exactly one definition — the same
 * pattern as `lib/live-support-policy.ts`.
 */
export function buildOwnIssueFilter(studentUserId: string) {
  return {
    createdBy: new mongoose.Types.ObjectId(studentUserId),
    deletedAt: null,
  };
}
