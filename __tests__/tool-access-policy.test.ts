import { describe, expect, it } from "vitest";

import {
  accessExpiresAt,
  addCalendarMonthsInDhaka,
  requestCreatesEntitlement,
  requestEntitlementAllowsProcessing,
  toolEntitlementState,
} from "@/lib/tool-access-policy";

describe("tool access policy", () => {
  it("uses calendar months in Dhaka and clamps the last day", () => {
    // 31 Dec 2026, 20:30 in Dhaka -> 28 Feb 2027, 20:30 in Dhaka.
    const granted = new Date("2026-12-31T14:30:00.000Z");
    expect(addCalendarMonthsInDhaka(granted, 2).toISOString()).toBe("2027-02-28T14:30:00.000Z");
  });

  it("handles leap years without using a 60-day approximation", () => {
    const granted = new Date("2027-12-31T18:30:00.000Z"); // 1 Jan 2028 in Dhaka
    expect(accessExpiresAt("OPENAI", granted).toISOString()).toBe("2028-02-29T18:30:00.000Z");
  });

  it("gives n8n twelve calendar months and OpenAI two", () => {
    const granted = new Date("2026-11-03T13:08:00.000Z");
    expect(accessExpiresAt("N8N", granted).toISOString()).toBe("2027-11-03T13:08:00.000Z");
    expect(accessExpiresAt("OPENAI", granted).toISOString()).toBe("2027-01-03T13:08:00.000Z");
  });

  it("never creates or extends an entitlement for a password reset", () => {
    expect(requestCreatesEntitlement("ACCESS")).toBe(true);
    expect(requestCreatesEntitlement("OPENAI_ACCESS")).toBe(true);
    expect(requestCreatesEntitlement("PASSWORD_RESET")).toBe(false);
  });

  it("allows password resets only with active n8n access", () => {
    expect(requestEntitlementAllowsProcessing("PASSWORD_RESET", "ACTIVE")).toBe(true);
    expect(requestEntitlementAllowsProcessing("PASSWORD_RESET", null)).toBe(false);
    expect(requestEntitlementAllowsProcessing("PASSWORD_RESET", "EXPIRED")).toBe(false);
    expect(requestEntitlementAllowsProcessing("PASSWORD_RESET", "REVOKED")).toBe(false);
  });

  it("allows new access only when no entitlement exists", () => {
    expect(requestEntitlementAllowsProcessing("ACCESS", null)).toBe(true);
    expect(requestEntitlementAllowsProcessing("OPENAI_ACCESS", null)).toBe(true);
    expect(requestEntitlementAllowsProcessing("ACCESS", "ACTIVE")).toBe(false);
    expect(requestEntitlementAllowsProcessing("OPENAI_ACCESS", "EXPIRED")).toBe(false);
  });

  it("derives active, expired and revoked states", () => {
    const now = new Date("2026-11-03T00:00:00.000Z");
    expect(toolEntitlementState({ expiresAt: "2026-11-04T00:00:00.000Z" }, now)).toBe("ACTIVE");
    expect(toolEntitlementState({ expiresAt: "2026-11-03T00:00:00.000Z" }, now)).toBe("EXPIRED");
    expect(toolEntitlementState({ expiresAt: "2027-01-01T00:00:00.000Z", revokedAt: now }, now)).toBe("REVOKED");
  });
});
