import { describe, expect, it } from "vitest";

import {
  assertOperationPayload,
  fixedWindow,
  mutationRequestHash,
  MutationConflictError,
  operationIdSchema,
  rateLimitBucketKey,
} from "@/lib/mutation-security";

describe("mutation security helpers", () => {
  it("accepts UUID operation ids and rejects reusable free-form values", () => {
    expect(operationIdSchema.parse("550e8400-e29b-41d4-a716-446655440000"))
      .toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(() => operationIdSchema.parse("create-issue")).toThrow();
    expect(() => operationIdSchema.parse("")).toThrow();
  });

  it("calculates stable fixed-window boundaries", () => {
    const first = fixedWindow(new Date("2026-10-11T10:20:30.500Z"), 60_000);
    const retry = fixedWindow(new Date("2026-10-11T10:20:59.999Z"), 60_000);

    expect(first).toEqual(retry);
    expect(first.expiresAt.toISOString()).toBe("2026-10-11T10:21:00.000Z");
  });

  it("scopes buckets by operation, account, and window", () => {
    const startMs = Date.parse("2026-10-11T10:20:00.000Z");
    expect(rateLimitBucketKey("reply.add", "actor-a", startMs))
      .not.toBe(rateLimitBucketKey("reply.add", "actor-b", startMs));
    expect(rateLimitBucketKey("reply.add", "actor-a", startMs))
      .not.toBe(rateLimitBucketKey("reply.edit", "actor-a", startMs));
  });

  it("rejects invalid fixed-window durations", () => {
    expect(() => fixedWindow(new Date(), 0)).toThrow("Invalid rate-limit window");
    expect(() => fixedWindow(new Date(), 1.5)).toThrow("Invalid rate-limit window");
  });

  it("hashes equivalent payloads identically regardless of key order", () => {
    const left = mutationRequestHash({ title: "A", tags: ["x", "y"], priority: "LOW" });
    const right = mutationRequestHash({ priority: "LOW", tags: ["x", "y"], title: "A" });
    const different = mutationRequestHash({ priority: "HIGH", tags: ["x", "y"], title: "A" });

    expect(left).toBe(right);
    expect(left).not.toBe(different);
  });

  it("accepts a replayed match and rejects a reused key with a different payload", () => {
    const hash = mutationRequestHash({ body: "answer" });
    expect(() => assertOperationPayload(hash, hash)).not.toThrow();
    expect(() => assertOperationPayload(null, hash)).not.toThrow();
    expect(() => assertOperationPayload(hash, mutationRequestHash({ body: "other" })))
      .toThrow(MutationConflictError);
  });
});
