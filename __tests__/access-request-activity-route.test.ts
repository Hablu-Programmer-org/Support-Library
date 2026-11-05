// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { auth, consumeRateLimit, snapshot } = vi.hoisted(() => ({
  auth: vi.fn(),
  consumeRateLimit: vi.fn(),
  snapshot: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/services/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => consumeRateLimit(...args),
  MutationRateLimitError: class MutationRateLimitError extends Error {},
}));
vi.mock("@/lib/services/access-request-activity", () => ({
  getAccessRequestActivitySnapshot: () => snapshot(),
}));

import { GET } from "@/app/api/access-requests/activity/route";

describe("GET /api/access-requests/activity", () => {
  it("denies anonymous and non-exact admins", async () => {
    auth.mockResolvedValueOnce(null);
    expect((await GET()).status).toBe(401);

    auth.mockResolvedValueOnce({
      user: { id: "u1", role: "ADMIN", isActive: true, canManageToolAccess: false },
    });
    expect((await GET()).status).toBe(403);
  });

  it("returns only the revision and queued count for an exact admin", async () => {
    auth.mockResolvedValueOnce({
      user: { id: "u1", role: "ADMIN", isActive: true, canManageToolAccess: true },
    });
    snapshot.mockResolvedValueOnce({ revision: "2026-11-05T10:00:00.000Z:abc", count: 2 });

    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      revision: "2026-11-05T10:00:00.000Z:abc",
      count: 2,
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(consumeRateLimit).toHaveBeenCalledWith("access.requests.activity", "u1");
  });
});
