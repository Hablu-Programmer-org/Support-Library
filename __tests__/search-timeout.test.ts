import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { isSearchTimeoutError, SearchTimeoutError } from "@/lib/services/issues";

/**
 * The timeout contract: only a Mongo `maxTimeMS` exceedance (code 50) becomes
 * the recoverable `SearchTimeoutError` the page renders as a notice. Every
 * other error must propagate — converting a connectivity or auth failure into
 * an empty list would hide a real outage.
 */
describe("isSearchTimeoutError", () => {
  it("recognizes a Mongo max-time exceedance", () => {
    expect(isSearchTimeoutError({ code: 50 })).toBe(true);
  });

  it("rejects other errors", () => {
    expect(isSearchTimeoutError(new Error("connection refused"))).toBe(false);
    expect(isSearchTimeoutError({ code: 13 })).toBe(false);
    expect(isSearchTimeoutError(null)).toBe(false);
    expect(isSearchTimeoutError(undefined)).toBe(false);
    expect(isSearchTimeoutError("code 50")).toBe(false);
  });

  it("round-trips through SearchTimeoutError identity", () => {
    const error = new SearchTimeoutError();
    expect(error).toBeInstanceOf(SearchTimeoutError);
    expect(error.name).toBe("SearchTimeoutError");
    // SearchTimeoutError itself is not a driver error and must not re-match.
    expect(isSearchTimeoutError(error)).toBe(false);
  });
});
