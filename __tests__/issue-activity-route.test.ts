// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { auth, consumeRateLimit, getIssueActivitySnapshot } = vi.hoisted(() => ({
  auth: vi.fn(),
  consumeRateLimit: vi.fn(),
  getIssueActivitySnapshot: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/services/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => consumeRateLimit(...args),
  MutationRateLimitError: class MutationRateLimitError extends Error {},
}));
vi.mock("@/lib/services/issue-activity", () => ({
  getIssueActivitySnapshot: () => getIssueActivitySnapshot(),
}));

import { GET } from "@/app/api/issues/activity/route";

describe("GET /api/issues/activity", () => {
  it("rejects anonymous callers", async () => {
    auth.mockResolvedValueOnce(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("rejects inactive accounts", async () => {
    auth.mockResolvedValueOnce({ user: { id: "u1", role: "ADMIN", isActive: false } });
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("rejects students", async () => {
    auth.mockResolvedValueOnce({ user: { id: "u1", role: "STUDENT", isActive: true } });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(getIssueActivitySnapshot).not.toHaveBeenCalled();
  });

  it("returns only a revision/count snapshot for staff, uncached", async () => {
    auth.mockResolvedValueOnce({ user: { id: "u1", role: "MENTOR", isActive: true } });
    getIssueActivitySnapshot.mockResolvedValueOnce({ revision: "2026-11-02T18:40:12.004Z:42", count: 42 });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ revision: "2026-11-02T18:40:12.004Z:42", count: 42 });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(JSON.stringify(body)).not.toMatch(/title|email|question/i);
    expect(consumeRateLimit).toHaveBeenCalledWith("issues.activity", "u1");
  });
});
