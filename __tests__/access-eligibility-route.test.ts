// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { auth, consumeRateLimit, getStudentAgentEnrollment } = vi.hoisted(() => ({
  auth: vi.fn(),
  consumeRateLimit: vi.fn(),
  getStudentAgentEnrollment: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: () => auth() }));
vi.mock("@/lib/services/rate-limit", () => ({
  consumeRateLimit: (...args: unknown[]) => consumeRateLimit(...args),
  MutationRateLimitError: class MutationRateLimitError extends Error {},
}));
vi.mock("@/lib/services/n8n-requests", () => ({
  getStudentAgentEnrollment: (id: string) => getStudentAgentEnrollment(id),
}));

import { GET } from "@/app/api/access/eligibility/route";

describe("GET /api/access/eligibility", () => {
  it("rejects anonymous callers", async () => {
    auth.mockResolvedValueOnce(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("rejects inactive accounts", async () => {
    auth.mockResolvedValueOnce({ user: { id: "u1", role: "STUDENT", isActive: false } });
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("rejects non-students", async () => {
    auth.mockResolvedValueOnce({ user: { id: "u1", role: "MENTOR", isActive: true } });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(getStudentAgentEnrollment).not.toHaveBeenCalled();
  });

  it("returns eligible=false for students outside the agent course", async () => {
    auth.mockResolvedValueOnce({ user: { id: "u1", role: "STUDENT", isActive: true } });
    getStudentAgentEnrollment.mockResolvedValueOnce({
      enrolled: false,
      batchNo: null,
      enrollmentId: null,
      blocked: true,
    });
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ eligible: false, batchNo: null });
  });

  it("returns eligible=true with the trusted batch for agent students", async () => {
    auth.mockResolvedValueOnce({ user: { id: "u1", role: "STUDENT", isActive: true } });
    getStudentAgentEnrollment.mockResolvedValueOnce({
      enrolled: true,
      batchNo: 4,
      enrollmentId: "enr-1",
      blocked: false,
    });
    const response = await GET();
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ eligible: true, batchNo: 4 });
    expect(consumeRateLimit).toHaveBeenCalledWith("access.eligibility", "u1");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns 429 when rate limited", async () => {
    auth.mockResolvedValueOnce({ user: { id: "u1", role: "STUDENT", isActive: true } });
    const { MutationRateLimitError } = await import("@/lib/services/rate-limit");
    consumeRateLimit.mockRejectedValueOnce(new (MutationRateLimitError as new () => Error)());
    const response = await GET();
    expect(response.status).toBe(429);
  });
});
