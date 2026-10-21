import mongoose from "mongoose";

import { LIVE_SUPPORT_ELIGIBLE_STATUSES } from "@/lib/constants";

/**
 * The only query shape that may decide live-support eligibility.
 *
 * `createdBy` is always the authenticated student, never a client-supplied id,
 * and the status filter is the resolved/unresolved boundary. It lives in this
 * pure module (no `server-only`, no database) so the read path, the join action
 * and a unit test all share exactly one definition.
 */
export function buildEligibleIssueFilter(studentUserId: string) {
  return {
    createdBy: new mongoose.Types.ObjectId(studentUserId),
    deletedAt: null,
    status: { $in: [...LIVE_SUPPORT_ELIGIBLE_STATUSES] },
  };
}
