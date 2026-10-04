import { describe, expect, it } from "vitest";

import authConfig from "@/auth.config";

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
