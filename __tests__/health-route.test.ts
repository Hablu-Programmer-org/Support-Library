import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkSupportReadiness, checkLmsReadiness } = vi.hoisted(() => ({
  checkSupportReadiness: vi.fn(),
  checkLmsReadiness: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ checkSupportReadiness }));
vi.mock("@/lib/lms-db", () => ({ checkLmsReadiness }));
vi.mock("@/lib/env", () => ({ validateProductionEnv: vi.fn() }));

import { GET } from "@/app/api/health/route";

describe("readiness route", () => {
  beforeEach(() => {
    checkSupportReadiness.mockReset();
    checkLmsReadiness.mockReset();
  });

  it("returns 503 when a database readiness check fails", async () => {
    checkSupportReadiness.mockRejectedValueOnce(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ ok: false, ready: false });
  });

  it("returns ready only after both database checks pass", async () => {
    checkSupportReadiness.mockResolvedValueOnce(undefined);
    checkLmsReadiness.mockResolvedValueOnce(undefined);

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, ready: true });
    expect(checkSupportReadiness).toHaveBeenCalledOnce();
    expect(checkLmsReadiness).toHaveBeenCalledOnce();
  });
});
