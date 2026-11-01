// @vitest-environment node
import { describe, expect, it } from "vitest";

import { externalRedirect, isHttpsUrl } from "@/lib/external-redirect";

describe("isHttpsUrl", () => {
  it("accepts absolute HTTPS URLs", () => {
    expect(isHttpsUrl("https://meet.google.com/abc-defg-hij")).toBe(true);
    expect(isHttpsUrl("https://us05web.zoom.us/j/123?pwd=x")).toBe(true);
  });

  it("rejects everything else", () => {
    for (const value of [
      "http://meet.google.com/abc-defg-hij",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "/dashboard/support",
      "meet.google.com/abc-defg-hij",
      "",
      null,
      undefined,
      42,
    ]) {
      expect(isHttpsUrl(value)).toBe(false);
    }
  });
});

describe("externalRedirect", () => {
  it("returns the URL when it is safe", () => {
    expect(externalRedirect("https://meet.google.com/abc-defg-hij", "nope")).toEqual({
      url: "https://meet.google.com/abc-defg-hij",
    });
  });

  it("converts a missing or unsafe URL into the caller's error", () => {
    expect(externalRedirect(null, "not configured")).toEqual({ error: "not configured" });
    expect(externalRedirect("javascript:alert(1)", "not configured")).toEqual({
      error: "not configured",
    });
  });
});
