import { afterEach, describe, expect, it } from "vitest";

import { getAuthRateLimitScope } from "@/lib/auth-rate-limit";
import { getClientIp } from "@/lib/client-ip";
import { createContentSecurityPolicy } from "@/lib/content-security-policy";

const originalTrustedProxyHops = process.env.TRUSTED_PROXY_HOPS;

afterEach(() => {
  if (originalTrustedProxyHops === undefined) delete process.env.TRUSTED_PROXY_HOPS;
  else process.env.TRUSTED_PROXY_HOPS = originalTrustedProxyHops;
});

describe("runtime security helpers", () => {
  it("uses a nonce without unsafe-eval in the production CSP", () => {
    const policy = createContentSecurityPolicy("test-nonce", false);

    expect(policy).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(policy).not.toContain("'unsafe-eval'");
  });

  it("limits only Google OAuth initiation and callback paths", () => {
    expect(getAuthRateLimitScope("POST", "/api/auth/signin/google")).toBe("oauth.signin");
    expect(getAuthRateLimitScope("GET", "/api/auth/callback/google")).toBe("oauth.callback");
    expect(getAuthRateLimitScope("GET", "/api/auth/session")).toBeNull();
    expect(getAuthRateLimitScope("POST", "/api/auth/signout")).toBeNull();
  });

  it("selects client IP from the trusted side of the forwarding chain", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    const headers = new Headers({
      "x-forwarded-for": "198.51.100.4, 203.0.113.9",
    });

    expect(getClientIp(headers)).toBe("203.0.113.9");
  });

  it("ignores forwarding headers when no proxy hop is trusted", () => {
    process.env.TRUSTED_PROXY_HOPS = "0";
    expect(getClientIp(new Headers({ "x-forwarded-for": "198.51.100.4" }))).toBeUndefined();
  });
});
