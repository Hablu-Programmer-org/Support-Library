import type { CaseStatus, UserRole } from "@/lib/constants";
import { isAdmin } from "@/lib/roles";

/**
 * Decides whether a status change also asks the service layer to publish.
 *
 * Auto-publishing on solve is still a publication, so it keeps the same gate as
 * the explicit publish form: only an admin, and only after the short PII
 * confirmation. Mentors can solve an issue; an admin publishes it.
 */
export function shouldPublishOnSolve(input: {
  status: CaseStatus;
  role: UserRole;
  confirmed: boolean;
}): boolean {
  return input.status === "SOLVED" && input.confirmed && isAdmin(input.role);
}
