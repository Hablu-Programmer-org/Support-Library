// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  accessEmailMessageId,
  accessEmailPurgeAt,
  accessEmailRetryDelay,
  ACCESS_EMAIL_MAX_ATTEMPTS,
  ACCESS_EMAIL_TERMINAL_RETENTION_MS,
  approvalFinalizePlan,
  isTransientAccessEmailError,
  nextAccessEmailAttemptAt,
  notificationForRequest,
  recipientAccepted,
  sanitizedAccessEmailErrorCode,
} from "@/lib/access-email-outbox-policy";

describe("access email outbox policy", () => {
  it("maps each request type to exactly one notification", () => {
    expect(notificationForRequest("ACCESS")).toBe("N8N_ACCESS");
    expect(notificationForRequest("PASSWORD_RESET")).toBe("N8N_PASSWORD_RESET");
    expect(notificationForRequest("OPENAI_ACCESS")).toBe("OPENAI_CONFIRMATION");
  });

  it("uses a per-job Message-ID so a retry generation cannot collide", () => {
    const first = accessEmailMessageId("N8N_ACCESS", "job-a");
    const second = accessEmailMessageId("N8N_ACCESS", "job-b");
    expect(first).not.toBe(second);
    expect(accessEmailMessageId("ACCESS_REJECTION", "job-a")).toContain("access-rejected-job-a");
  });

  it("caps backoff and clamps retries to the payload expiry", () => {
    expect(accessEmailRetryDelay(1)).toBe(60_000);
    expect(accessEmailRetryDelay(99)).toBe(6 * 60 * 60_000);

    const now = Date.parse("2026-11-05T10:00:00.000Z");
    const expiry = new Date(now + 90_000);
    const scheduled = nextAccessEmailAttemptAt({
      now,
      attempts: 4,
      payloadExpiresAt: expiry,
      jitter: 0,
    });
    // Attempt 4's backoff is one hour, far past the 30-minute link window.
    expect(scheduled.getTime()).toBe(expiry.getTime());

    const withoutPayload = nextAccessEmailAttemptAt({
      now,
      attempts: 2,
      payloadExpiresAt: null,
      jitter: 0,
    });
    expect(withoutPayload.getTime()).toBe(now + 5 * 60_000);
  });

  it("treats 4xx SMTP replies and transport faults as retryable", () => {
    expect(isTransientAccessEmailError({ responseCode: 451 })).toBe(true);
    expect(isTransientAccessEmailError({ responseCode: 550 })).toBe(false);
    expect(isTransientAccessEmailError({ code: "ETIMEDOUT" })).toBe(true);
    expect(isTransientAccessEmailError({ code: "SMTP_DEADLINE" })).toBe(true);
    expect(isTransientAccessEmailError({ code: "EAUTH" })).toBe(false);
    expect(isTransientAccessEmailError(new Error("socket hang up"))).toBe(true);
  });

  it("requires the provider to accept the exact recipient", () => {
    expect(recipientAccepted({ accepted: ["Student@Example.com"], rejected: [] }, "student@example.com")).toBe(true);
    expect(recipientAccepted({ accepted: ["other@example.com"], rejected: [] }, "student@example.com")).toBe(false);
    expect(recipientAccepted({ accepted: ["student@example.com"], rejected: ["student@example.com"] }, "student@example.com")).toBe(false);
  });

  it("sanitizes provider error codes and keeps terminal retention finite", () => {
    expect(sanitizedAccessEmailErrorCode({ responseCode: 550 })).toBe("550");
    expect(sanitizedAccessEmailErrorCode({ code: "ERECIPIENT\nInjected" })).toBe("ERECIPIENTInjected");
    expect(sanitizedAccessEmailErrorCode(null)).toBe("UNKNOWN");

    const now = new Date("2026-11-05T10:00:00.000Z");
    expect(accessEmailPurgeAt(now).getTime() - now.getTime()).toBe(ACCESS_EMAIL_TERMINAL_RETENTION_MS);
  });

  it("keeps the attempt ceiling small enough to bound repeated provider sends", () => {
    expect(ACCESS_EMAIL_MAX_ATTEMPTS).toBe(5);
  });

  it("finalizes an accepted email forward unless the request state truly conflicts", () => {
    // Provider acceptance wins over a stale generation's FAILED marker.
    expect(approvalFinalizePlan("PROCESSING")).toBe("FINALIZE");
    expect(approvalFinalizePlan("FAILED")).toBe("FINALIZE");
    // A second finalization is idempotent.
    expect(approvalFinalizePlan("SENT")).toBe("ALREADY_SENT");
    // These states mean the request was never (or no longer) ours to finish.
    expect(approvalFinalizePlan("PENDING")).toBe("CONFLICT");
    expect(approvalFinalizePlan("REJECTED")).toBe("CONFLICT");
    expect(approvalFinalizePlan("SUPERSEDED")).toBe("CONFLICT");
  });
});
