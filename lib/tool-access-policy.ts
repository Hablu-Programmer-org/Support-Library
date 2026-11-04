import type { N8nRequestType } from "@/models/n8n-access-request";

export const TOOL_ACCESS_TOOLS = ["N8N", "OPENAI"] as const;
export type ToolAccessTool = (typeof TOOL_ACCESS_TOOLS)[number];

export const TOOL_ACCESS_POLICY = {
  N8N: { key: "agent-n8n-v1", durationMonths: 12 },
  OPENAI: { key: "agent-openai-v1", durationMonths: 2 },
} as const satisfies Record<ToolAccessTool, { key: string; durationMonths: number }>;

/** Dhaka has no DST; keeping the calendar calculation explicit avoids host-timezone drift. */
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000;

export function addCalendarMonthsInDhaka(value: Date, months: number): Date {
  if (!Number.isInteger(months) || months < 1 || Number.isNaN(value.getTime())) {
    throw new Error("A valid date and positive whole-month duration are required");
  }

  const local = new Date(value.getTime() + DHAKA_OFFSET_MS);
  const monthIndex = local.getUTCFullYear() * 12 + local.getUTCMonth() + months;
  const targetYear = Math.floor(monthIndex / 12);
  const targetMonth = monthIndex % 12;
  const lastTargetDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(local.getUTCDate(), lastTargetDay);

  const targetLocalMs = Date.UTC(
    targetYear,
    targetMonth,
    targetDay,
    local.getUTCHours(),
    local.getUTCMinutes(),
    local.getUTCSeconds(),
    local.getUTCMilliseconds(),
  );
  return new Date(targetLocalMs - DHAKA_OFFSET_MS);
}

export function entitlementToolForRequest(requestType: N8nRequestType): ToolAccessTool {
  return requestType === "OPENAI_ACCESS" ? "OPENAI" : "N8N";
}

/** Password resets use an existing n8n entitlement and never create or extend one. */
export function requestCreatesEntitlement(requestType: N8nRequestType): boolean {
  return requestType === "ACCESS" || requestType === "OPENAI_ACCESS";
}

/**
 * New access can only be granted once, while a password reset is valid only
 * for a student whose existing n8n access is still active.
 */
export function requestEntitlementAllowsProcessing(
  requestType: N8nRequestType,
  entitlementState: ToolEntitlementState | null,
): boolean {
  return requestType === "PASSWORD_RESET"
    ? entitlementState === "ACTIVE"
    : entitlementState === null;
}

export function accessExpiresAt(tool: ToolAccessTool, grantedAt: Date): Date {
  return addCalendarMonthsInDhaka(grantedAt, TOOL_ACCESS_POLICY[tool].durationMonths);
}

export type ToolEntitlementState = "ACTIVE" | "EXPIRED" | "REVOKED";

export function toolEntitlementState(
  entitlement: { expiresAt: Date | string; revokedAt?: Date | string | null },
  now = new Date(),
): ToolEntitlementState {
  if (entitlement.revokedAt) return "REVOKED";
  const expiresAt = entitlement.expiresAt instanceof Date
    ? entitlement.expiresAt
    : new Date(entitlement.expiresAt);
  return expiresAt.getTime() > now.getTime() ? "ACTIVE" : "EXPIRED";
}
