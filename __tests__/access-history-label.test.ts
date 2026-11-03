import { describe, expect, it } from "vitest";

import { accessHistoryLabel } from "@/lib/access-history-label";

describe("accessHistoryLabel", () => {
  it("says this is the first request when nothing was delivered", () => {
    expect(accessHistoryLabel("ACCESS", 0)).toBe("First n8n access request");
    expect(accessHistoryLabel("PASSWORD_RESET", 0)).toBe("First password reset request");
    expect(accessHistoryLabel("OPENAI_ACCESS", 0)).toBe("First OpenAI request");
  });

  it("counts delivered emails and shows the last date", () => {
    // 1 Nov 2026 in Asia/Dhaka.
    const lastSentAt = new Date("2026-11-01T06:00:00.000Z");
    expect(accessHistoryLabel("ACCESS", 2, lastSentAt)).toBe(
      "n8n access sent 2× · Last 1 Nov",
    );
    expect(accessHistoryLabel("OPENAI_ACCESS", 1, lastSentAt)).toBe(
      "OpenAI invite sent 1× · Last 1 Nov",
    );
  });

  it("omits the date when it is missing or invalid", () => {
    expect(accessHistoryLabel("ACCESS", 3, null)).toBe("n8n access sent 3×");
    expect(accessHistoryLabel("PASSWORD_RESET", 1, "not-a-date")).toBe("reset link sent 1×");
  });

  it("treats a negative or non-finite count as no history", () => {
    expect(accessHistoryLabel("ACCESS", -1)).toBe("First n8n access request");
    expect(accessHistoryLabel("ACCESS", Number.NaN)).toBe("First n8n access request");
  });
});