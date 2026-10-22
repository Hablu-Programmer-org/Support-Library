import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/auth", () => ({ auth: vi.fn() }));

import { createCsrfToken, verifyCsrfToken } from "@/lib/csrf";
import { auth } from "@/auth";
import { withCsrfProtection } from "@/lib/safe-action";

const secret = "test-secret-with-sufficient-entropy";
const now = Date.parse("2026-10-12T12:00:00.000Z");

beforeEach(() => {
  vi.mocked(auth).mockResolvedValue({
    user: { id: "user-a", isActive: true },
    expires: new Date(now + 60_000).toISOString(),
  } as never);
  vi.stubEnv("AUTH_SECRET", secret);
});

describe("CSRF tokens", () => {
  it("accepts a valid token for the same user before expiry", () => {
    const token = createCsrfToken("user-a", secret, now, "fixed-nonce");
    expect(verifyCsrfToken(token, "user-a", secret, now + 1_000)).toBe(true);
  });

  it("rejects missing, malformed, tampered, and cross-user tokens", () => {
    const token = createCsrfToken("user-a", secret, now, "fixed-nonce");
    expect(verifyCsrfToken("", "user-a", secret, now)).toBe(false);
    expect(verifyCsrfToken("not-a-token", "user-a", secret, now)).toBe(false);
    expect(verifyCsrfToken(`${token}x`, "user-a", secret, now)).toBe(false);
    expect(verifyCsrfToken(token, "user-b", secret, now)).toBe(false);
  });

  it("rejects an expired token", () => {
    const token = createCsrfToken("user-a", secret, now, "fixed-nonce");
    expect(verifyCsrfToken(token, "user-a", secret, now + 8 * 60 * 60 * 1_000 + 1_000)).toBe(false);
  });

  it("requires a valid token before invoking a protected action", async () => {
    const action = vi.fn(async () => "mutated");
    const missing = new FormData();
    // With a live session a missing token is treated as tampering, exactly like
    // a bad signature; only the no-session case redirects to sign in.
    await expect(withCsrfProtection(missing, action)).rejects.toThrow("Invalid CSRF token");

    const invalid = new FormData();
    invalid.set("csrfToken", "invalid");
    await expect(withCsrfProtection(invalid, action)).rejects.toThrow("Invalid CSRF token");

    const valid = new FormData();
    valid.set("csrfToken", createCsrfToken("user-a", secret));
    await expect(withCsrfProtection(valid, action)).resolves.toBe("mutated");
    expect(action).toHaveBeenCalledOnce();
  });
});
