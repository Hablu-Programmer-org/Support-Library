import { describe, expect, it } from "vitest";

import type { CreateFailure } from "@/lib/access-request-outcome";
import {
  describeCreateFailure,
  describeQueueEmailFailure,
  failureDetail,
  summarizeCreateAttempt,
} from "@/lib/access-request-messages";

const expiresAt = new Date("2027-11-07T05:04:52.000Z");
const revokedAt = new Date("2026-10-01T05:00:00.000Z");

const activeAccess: CreateFailure = {
  ok: false,
  code: "ALREADY_HAS_ACCESS",
  requestType: "ACCESS",
  entitlement: { state: "ACTIVE", expiresAt, revokedAt: null },
};

describe("describeCreateFailure", () => {
  it("says active access is still valid instead of claiming an active request", () => {
    expect(describeCreateFailure(activeAccess, "ADMIN"))
      .toBe("This student already has n8n access until 7 Nov 2027.");
    expect(describeCreateFailure(activeAccess, "STUDENT"))
      .toBe("Your n8n access is active until 7 Nov 2027.");
  });

  it("names expiry and revocation with their dates", () => {
    expect(describeCreateFailure({
      ok: false,
      code: "ACCESS_EXPIRED",
      requestType: "ACCESS",
      entitlement: { state: "EXPIRED", expiresAt, revokedAt: null },
    }, "ADMIN")).toBe("This student's n8n access expired on 7 Nov 2027.");

    expect(describeCreateFailure({
      ok: false,
      code: "ACCESS_REVOKED",
      requestType: "ACCESS",
      entitlement: { state: "REVOKED", expiresAt, revokedAt },
    }, "ADMIN")).toBe("This student's n8n access was revoked on 1 Oct 2026.");
  });

  it("explains that a reset needs active access first", () => {
    expect(describeCreateFailure({
      ok: false,
      code: "NO_ACTIVE_ACCESS_FOR_RESET",
      requestType: "PASSWORD_RESET",
    }, "ADMIN")).toContain("Send the n8n access request first");
    expect(describeCreateFailure({
      ok: false,
      code: "NO_ACTIVE_ACCESS_FOR_RESET",
      requestType: "PASSWORD_RESET",
    }, "STUDENT")).toContain("Request n8n access first");
  });

  it("keeps the duplicate wording for a real active request only", () => {
    expect(describeCreateFailure({
      ok: false,
      code: "ACTIVE_REQUEST_EXISTS",
      requestType: "OPENAI_ACCESS",
    }, "ADMIN")).toBe("An active OpenAI API access request already exists for this account.");
  });

  it("reports a blocked enrolment", () => {
    expect(describeCreateFailure({
      ok: false,
      code: "ENROLLMENT_BLOCKED",
      requestType: "ACCESS",
    }, "ADMIN")).toBe("This student is not enrolled in the AI Agent course.");
  });
});

describe("failureDetail", () => {
  it("builds the short clause used inside a mixed sentence", () => {
    expect(failureDetail(activeAccess)).toBe("n8n access is active until 7 Nov 2027");
  });
});

describe("summarizeCreateAttempt", () => {
  it("returns one sentence when everything was refused for the same reason", () => {
    expect(summarizeCreateAttempt({
      createdTypes: [],
      skipped: [activeAccess],
      audience: "ADMIN",
    })).toEqual({ error: "This student already has n8n access until 7 Nov 2027." });
  });

  it("lists each mixed reason separately", () => {
    const summary = summarizeCreateAttempt({
      createdTypes: [],
      skipped: [
        activeAccess,
        { ok: false, code: "NO_ACTIVE_ACCESS_FOR_RESET", requestType: "PASSWORD_RESET" },
      ],
      audience: "ADMIN",
    });
    expect(summary.error).toContain("Nothing was created.");
    expect(summary.error).toContain("n8n access: n8n access is active until 7 Nov 2027");
    expect(summary.error).toContain("n8n password reset: needs active n8n access first");
    expect(summary.error).not.toContain("already has an active");
  });

  it("reports partial success with a warning instead of hiding the skip", () => {
    expect(summarizeCreateAttempt({
      createdTypes: ["PASSWORD_RESET"],
      skipped: [activeAccess],
      audience: "ADMIN",
      email: "student@example.com",
    })).toEqual({
      success: "1 request created for student@example.com.",
      warning: "Skipped n8n access (n8n access is active until 7 Nov 2027).",
    });
  });

  it("pluralises the student message and adds no warning when everything worked", () => {
    expect(summarizeCreateAttempt({
      createdTypes: ["ACCESS", "OPENAI_ACCESS"],
      skipped: [],
      audience: "STUDENT",
    })).toEqual({ success: "2 requests submitted." });
  });

  it("never says 'active request' unless the duplicate code is used", () => {
    const summary = summarizeCreateAttempt({
      createdTypes: [],
      skipped: [
        { ok: false, code: "ACCESS_EXPIRED", requestType: "ACCESS", entitlement: { state: "EXPIRED", expiresAt, revokedAt: null } },
        { ok: false, code: "ENROLLMENT_BLOCKED", requestType: "OPENAI_ACCESS" },
      ],
      audience: "STUDENT",
    });
    expect(summary.error).not.toContain("active request");
  });
});

describe("describeQueueEmailFailure", () => {
  it("never describes an entitlement decision as 'already handled'", () => {
    expect(describeQueueEmailFailure("ENTITLEMENT_MISMATCH", "PASSWORD_RESET"))
      .toBe("This student no longer has active n8n access, so a reset link cannot be sent.");
    expect(describeQueueEmailFailure("ENTITLEMENT_MISMATCH", "ACCESS"))
      .toBe("This student already has n8n access; this invitation is no longer needed.");
    expect(describeQueueEmailFailure("ENTITLEMENT_MISMATCH", "OPENAI_ACCESS"))
      .toBe("This student already has OpenAI access; this confirmation is no longer needed.");
  });

  it("keeps distinct wording for each send-path refusal", () => {
    expect(describeQueueEmailFailure("REQUEST_NOT_ACTIONABLE", "ACCESS")).toContain("already handled");
    expect(describeQueueEmailFailure("SUPERSEDED", "ACCESS")).toContain("newer request");
    expect(describeQueueEmailFailure("DUPLICATE_JOB", "ACCESS")).toContain("already queued");
    expect(describeQueueEmailFailure("LINK_REQUIRED", "ACCESS")).toContain("Paste the secure n8n link");
    expect(describeQueueEmailFailure("STUDENT_UNAVAILABLE", "ACCESS")).toContain("inactive");
    expect(describeQueueEmailFailure("ENROLLMENT_BLOCKED", "ACCESS")).toContain("no longer in the AI Agent course");
  });
});
