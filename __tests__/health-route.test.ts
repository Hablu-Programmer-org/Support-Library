import { beforeEach, describe, expect, it, vi } from "vitest";

const { checkSupportReadiness, checkLmsReadiness } = vi.hoisted(() => ({
  checkSupportReadiness: vi.fn(),
  checkLmsReadiness: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ checkSupportReadiness }));
vi.mock("@/lib/lms-db", () => ({ checkLmsReadiness }));
vi.mock("@/lib/env", () => ({ validateEnv: vi.fn() }));

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

  it("omits the release revision in production", async () => {
    checkSupportReadiness.mockResolvedValueOnce(undefined);
    checkLmsReadiness.mockResolvedValueOnce(undefined);
    const env = process.env as Record<string, string | undefined>;
    const originalNodeEnv = env.NODE_ENV;
    const originalRelease = env.DEPLOYMENT_VERSION;
    env.NODE_ENV = "production";
    env.DEPLOYMENT_VERSION = "deadbeef";
    try {
      const response = await GET();
      const body = await response.json();
      expect(body).not.toHaveProperty("release");
    } finally {
      env.NODE_ENV = originalNodeEnv;
      if (originalRelease === undefined) delete env.DEPLOYMENT_VERSION;
      else env.DEPLOYMENT_VERSION = originalRelease;
    }
  });

  it("reports the release revision outside production", async () => {
    checkSupportReadiness.mockResolvedValueOnce(undefined);
    checkLmsReadiness.mockResolvedValueOnce(undefined);
    const env = process.env as Record<string, string | undefined>;
    const originalNodeEnv = env.NODE_ENV;
    const originalRelease = env.DEPLOYMENT_VERSION;
    env.NODE_ENV = "development";
    env.DEPLOYMENT_VERSION = "deadbeef";
    try {
      const response = await GET();
      const body = await response.json();
      expect(body.release).toBe("deadbeef");
    } finally {
      env.NODE_ENV = originalNodeEnv;
      if (originalRelease === undefined) delete env.DEPLOYMENT_VERSION;
      else env.DEPLOYMENT_VERSION = originalRelease;
    }
  });
});
