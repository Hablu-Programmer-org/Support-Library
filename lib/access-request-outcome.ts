/**
 * Why an access request could not be created.
 *
 * `createN8nRequests` used to return `null` for several unrelated outcomes, and
 * every caller collapsed them into "already has an active request". In practice
 * the most common refusal is the entitlement policy (a password reset without
 * active n8n access, or a second grant while access is still active), so the
 * message was usually false.
 *
 * This module only *classifies* the existing policy decision; it never changes
 * it. `classifyCreateFailure` must stay in lock-step with
 * `requestEntitlementAllowsProcessing`, so the policy itself is the only source
 * of truth and this file is pure (no database, no `server-only`).
 */
import type { N8nRequestType } from "@/models/n8n-access-request";
import {
  requestEntitlementAllowsProcessing,
  type ToolEntitlementState,
} from "@/lib/tool-access-policy";

export type CreateFailureCode =
  | "ACTIVE_REQUEST_EXISTS"
  | "ALREADY_HAS_ACCESS"
  | "ACCESS_EXPIRED"
  | "ACCESS_REVOKED"
  | "NO_ACTIVE_ACCESS_FOR_RESET"
  | "RESET_ACCESS_EXPIRED"
  | "RESET_ACCESS_REVOKED"
  | "ENROLLMENT_BLOCKED";

export type EntitlementSnapshot = {
  state: ToolEntitlementState;
  expiresAt: Date | string;
  revokedAt: Date | string | null;
};

export type CreateFailure = {
  ok: false;
  code: CreateFailureCode;
  requestType: N8nRequestType;
  /** Present when an entitlement row decided the outcome. */
  entitlement?: EntitlementSnapshot;
};

/**
 * Maps the existing policy result to a user-facing reason.
 *
 * Returns `null` when the request may proceed, so a future policy change is
 * picked up automatically instead of drifting into a second rule set.
 */
export function classifyCreateFailure(
  requestType: N8nRequestType,
  entitlementState: ToolEntitlementState | null,
): CreateFailureCode | null {
  if (requestEntitlementAllowsProcessing(requestType, entitlementState)) return null;

  if (requestType === "PASSWORD_RESET") {
    if (entitlementState === "REVOKED") return "RESET_ACCESS_REVOKED";
    if (entitlementState === "EXPIRED") return "RESET_ACCESS_EXPIRED";
    return "NO_ACTIVE_ACCESS_FOR_RESET";
  }

  if (entitlementState === "REVOKED") return "ACCESS_REVOKED";
  if (entitlementState === "EXPIRED") return "ACCESS_EXPIRED";
  return "ALREADY_HAS_ACCESS";
}

/**
 * Only the active-request partial unique index may be reported as a duplicate.
 * An unrelated unique violation must keep bubbling up: silently telling the
 * admin "already requested" would hide a real write failure.
 */
export function isDuplicateActiveRequestError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { code?: unknown; keyPattern?: Record<string, unknown> | null };
  if (candidate.code !== 11000) return false;
  const pattern = candidate.keyPattern;
  // Older drivers omit `keyPattern`; the insert only has one unique index that
  // can fire here, so preserving the previous behaviour is safe.
  if (!pattern) return true;
  return "studentId" in pattern && "requestType" in pattern;
}
