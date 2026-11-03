// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { auth, consumeRateLimit, getOwnIssueActivitySnapshot } = vi.hoisted(() => ({
  auth: vi.fn(),
  consumeRateLimit: vi.fn(),
  getOwnIssueActivitySnapshot: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/services/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => consumeRateLimit(...args),
  MutationRateLimitError: class MutationRateLimitError extends Error {},
}));
vi.mock("@/lib/services/issue-activity", () => ({
  getOwnIssueActivitySnapshot: (...args: unknown[]) => getOwnIssueActivitySnapshot(...args),
}));

import { GET } from "@/app/api/my-requests/activity/route";
import { MutationRateLimitError } from "@/lib/services/rate-limit";

describe("GET /api/my-requests/activity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    consumeRateLimit.mockResolvedValue(undefined);
  });

  it("rejects anonymous callers", async () => {
    auth.mockResolvedValueOnce(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(getOwnIssueActivitySnapshot).not.toHaveBeenCalled();
  });

  it("rejects inactive accounts", async () => {
    auth.mockResolvedValueOnce({ user: { id: "u1", role: "STUDENT", isActive: false } });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(getOwnIssueActivitySnapshot).not.toHaveBeenCalled();
  });

  it("rejects staff accounts", async () => {
    auth.mockResolvedValueOnce({ user: { id: "u1", role: "MENTOR", isActive: true } });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(getOwnIssueActivitySnapshot).not.toHaveBeenCalled();
  });

  it("answers a student with a session-scoped, uncached revision/count only", async () => {
    auth.mockResolvedValueOnce({ user: { id: "u1", role: "STUDENT", isActive: true } });
    getOwnIssueActivitySnapshot.mockResolvedValueOnce({
      revision: "2026-11-03T09:12:00.000Z:2",
      count: 2,
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ revision: "2026-11-03T09:12:00.000Z:2", count: 2 });
    // No content or PII, only a change signal.
    expect(JSON.stringify(body)).not.toMatch(/title|email|question|reply/i);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    // Ownership comes from the session, never from a caller-supplied id.
    expect(consumeRateLimit).toHaveBeenCalledWith("my-requests.activity", "u1");
    expect(getOwnIssueActivitySnapshot).toHaveBeenCalledWith("u1");
    expect(getOwnIssueActivitySnapshot).toHaveBeenCalledTimes(1);
  });

  it("throttles without consulting the data layer", async () => {
    auth.mockResolvedValueOnce({ user: { id: "u1", role: "STUDENT", isActive: true } });
    consumeRateLimit.mockRejectedValueOnce(new MutationRateLimitError());

    const response = await GET();

    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getOwnIssueActivitySnapshot).not.toHaveBeenCalled();
  });

  it("reports a generic failure when the snapshot throws", async () => {
    auth.mockResolvedValueOnce({ user: { id: "u1", role: "STUDENT", isActive: true } });
    getOwnIssueActivitySnapshot.mockRejectedValueOnce(new Error("mongo down: db.internal"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(503);
    expect(body).toEqual({ error: "Unavailable" });
    expect(JSON.stringify(body)).not.toMatch(/mongo|internal/i);
  });
});
