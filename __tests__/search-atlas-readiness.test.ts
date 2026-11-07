/**
 * The Atlas-readiness guard: a missing index makes `$search` return zero rows
 * silently, so the service only runs Atlas when the scope's index is verified
 * queryable. The checker caches its answer for a few minutes, so creating the
 * indexes later enables Atlas without a restart.
 */
import { describe, expect, it, vi } from "vitest";

import { createAtlasReadinessChecker } from "@/lib/search-atlas";

describe("createAtlasReadinessChecker", () => {
  it("reports ready only for a queryable index name", async () => {
    const check = createAtlasReadinessChecker(async () => new Set(["issues_staff"]));

    expect(await check("issues_staff")).toBe(true);
    expect(await check("issues_public")).toBe(false);
  });

  it("treats a load failure as not ready instead of throwing", async () => {
    const check = createAtlasReadinessChecker(async () => {
      throw new Error("cluster unreachable");
    });

    expect(await check("issues_staff")).toBe(false);
  });

  it("caches within the TTL and re-checks after it", async () => {
    const load = vi.fn(async () => new Set<string>());
    let time = 0;
    const check = createAtlasReadinessChecker(load, {
      ttlMs: 1000,
      now: () => time,
    });

    await check("issues_staff");
    time += 999;
    await check("issues_staff");
    expect(load).toHaveBeenCalledTimes(1);

    time += 1;
    await check("issues_staff");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
