import { describe, expect, it } from "vitest";

import {
  classifyCreateFailure,
  isDuplicateActiveRequestError,
} from "@/lib/access-request-outcome";

describe("classifyCreateFailure", () => {
  it("lets new access through when no entitlement exists yet", () => {
    expect(classifyCreateFailure("ACCESS", null)).toBeNull();
    expect(classifyCreateFailure("OPENAI_ACCESS", null)).toBeNull();
  });

  it("refuses new access while an entitlement is active", () => {
    expect(classifyCreateFailure("ACCESS", "ACTIVE")).toBe("ALREADY_HAS_ACCESS");
    expect(classifyCreateFailure("OPENAI_ACCESS", "ACTIVE")).toBe("ALREADY_HAS_ACCESS");
  });

  it("names expiry and revocation instead of calling them active requests", () => {
    expect(classifyCreateFailure("ACCESS", "EXPIRED")).toBe("ACCESS_EXPIRED");
    expect(classifyCreateFailure("ACCESS", "REVOKED")).toBe("ACCESS_REVOKED");
    expect(classifyCreateFailure("OPENAI_ACCESS", "EXPIRED")).toBe("ACCESS_EXPIRED");
    expect(classifyCreateFailure("OPENAI_ACCESS", "REVOKED")).toBe("ACCESS_REVOKED");
  });

  it("only allows a password reset with active n8n access", () => {
    expect(classifyCreateFailure("PASSWORD_RESET", "ACTIVE")).toBeNull();
    expect(classifyCreateFailure("PASSWORD_RESET", null)).toBe("NO_ACTIVE_ACCESS_FOR_RESET");
    expect(classifyCreateFailure("PASSWORD_RESET", "EXPIRED")).toBe("RESET_ACCESS_EXPIRED");
    expect(classifyCreateFailure("PASSWORD_RESET", "REVOKED")).toBe("RESET_ACCESS_REVOKED");
  });
});

describe("isDuplicateActiveRequestError", () => {
  it("accepts the active-request unique index", () => {
    expect(isDuplicateActiveRequestError({
      code: 11000,
      keyPattern: { studentId: 1, requestType: 1 },
    })).toBe(true);
  });

  it("treats a driver error without keyPattern as the same duplicate", () => {
    expect(isDuplicateActiveRequestError({ code: 11000 })).toBe(true);
  });

  it("rethrows unrelated unique violations", () => {
    expect(isDuplicateActiveRequestError({
      code: 11000,
      keyPattern: { messageId: 1 },
    })).toBe(false);
  });

  it("ignores non-duplicate errors", () => {
    expect(isDuplicateActiveRequestError(new Error("boom"))).toBe(false);
    expect(isDuplicateActiveRequestError(null)).toBe(false);
    expect(isDuplicateActiveRequestError({ code: 121 })).toBe(false);
  });
});
