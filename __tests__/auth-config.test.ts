import { describe, expect, it } from "vitest";

import authConfig, { SESSION_MAX_AGE_SECONDS } from "@/auth.config";

const THIRTY_DAYS = 30 * 24 * 60 * 60;

describe("authConfig session lifetime", () => {
  it("keeps JWT sessions for 30 days", () => {
    expect(SESSION_MAX_AGE_SECONDS).toBe(THIRTY_DAYS);
    expect(authConfig.session.maxAge).toBe(THIRTY_DAYS);
    expect(authConfig.session.strategy).toBe("jwt");
  });

  it("sets the session cookie Max-Age to the same 30 days", () => {
    // A cookie Max-Age shorter than session.maxAge silently caps the session:
    // the browser drops the cookie before the JWT expires.
    expect(authConfig.cookies?.sessionToken?.options?.maxAge).toBe(SESSION_MAX_AGE_SECONDS);
  });
});

describe("authConfig session callback", () => {
  it("copies staff claims from token into session for middleware", async () => {
    const session = await authConfig.callbacks?.session?.({
      session: {
        user: {
          name: "Mentor",
          email: "mentor@example.com",
          image: null,
        },
        expires: new Date(Date.now() + 60_000).toISOString(),
      },
      token: {
        id: "staff-user-id",
        sub: "adapter-user-id",
        role: "MENTOR",
        isActive: true,
      },
    } as never);

    expect(session?.user.id).toBe("staff-user-id");
    expect(session?.user.role).toBe("MENTOR");
    expect(session?.user.isActive).toBe(true);
  });

  it("falls back to token.sub when token.id is missing", async () => {
    const session = await authConfig.callbacks?.session?.({
      session: {
        user: {
          name: "Admin",
          email: "admin@example.com",
          image: null,
        },
        expires: new Date(Date.now() + 60_000).toISOString(),
      },
      token: {
        sub: "adapter-user-id",
        role: "ADMIN",
        isActive: true,
      },
    } as never);

    expect(session?.user.id).toBe("adapter-user-id");
    expect(session?.user.role).toBe("ADMIN");
    expect(session?.user.isActive).toBe(true);
  });
});
