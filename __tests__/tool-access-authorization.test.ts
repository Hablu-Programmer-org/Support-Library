// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { auth, verifyCsrfTokenForUser, recentlySignedIn, getRequestContext } = vi.hoisted(() => ({
  auth: vi.fn(),
  verifyCsrfTokenForUser: vi.fn(),
  recentlySignedIn: vi.fn(),
  getRequestContext: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/csrf", () => ({
  verifyCsrfTokenForUser: (...args: unknown[]) => verifyCsrfTokenForUser(...args),
}));
vi.mock("@/lib/recent-auth", () => ({
  recentlySignedIn: (...args: unknown[]) => recentlySignedIn(...args),
}));
vi.mock("@/lib/request-context", () => ({
  getRequestContext: () => getRequestContext(),
}));

import { authorizeToolAccessDecision } from "@/lib/tool-access-authorization";

function form() {
  const data = new FormData();
  data.set("csrfToken", "signed-token");
  return data;
}

describe("authorizeToolAccessDecision", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyCsrfTokenForUser.mockReturnValue(true);
    recentlySignedIn.mockResolvedValue(true);
    getRequestContext.mockResolvedValue({ requestId: "req-1" });
  });

  it("uses one fresh auth resolution and returns a verified actor", async () => {
    auth.mockResolvedValue({
      user: {
        id: "507f1f77bcf86cd799439011",
        email: "admin@example.com",
        isActive: true,
        canManageToolAccess: true,
      },
    });

    const result = await authorizeToolAccessDecision(form());

    expect(result.ok).toBe(true);
    expect(auth).toHaveBeenCalledTimes(1);
    expect(verifyCsrfTokenForUser).toHaveBeenCalledWith(
      "signed-token",
      "507f1f77bcf86cd799439011",
    );
    expect(recentlySignedIn).toHaveBeenCalledTimes(1);
  });

  it("denies a broad local admin without the exact LMS capability", async () => {
    auth.mockResolvedValue({
      user: {
        id: "507f1f77bcf86cd799439011",
        email: "manager@example.com",
        role: "ADMIN",
        isActive: true,
        canManageToolAccess: false,
      },
    });

    const result = await authorizeToolAccessDecision(form());

    expect(result.ok).toBe(false);
    expect(verifyCsrfTokenForUser).not.toHaveBeenCalled();
  });

  it("fails closed for CSRF and stale recent authentication", async () => {
    auth.mockResolvedValue({
      user: {
        id: "507f1f77bcf86cd799439011",
        email: "admin@example.com",
        isActive: true,
        canManageToolAccess: true,
      },
    });
    verifyCsrfTokenForUser.mockReturnValueOnce(false);
    expect((await authorizeToolAccessDecision(form())).ok).toBe(false);

    verifyCsrfTokenForUser.mockReturnValueOnce(true);
    recentlySignedIn.mockResolvedValueOnce(false);
    const stale = await authorizeToolAccessDecision(form());
    expect(stale).toEqual({
      ok: false,
      state: { error: "Verify with Google to continue.", errorCode: "REAUTH_REQUIRED" },
    });
  });
});
