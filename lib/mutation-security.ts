import { createHash } from "node:crypto";

import { z } from "zod";

export const operationIdSchema = z.uuid("Invalid operation id");

export class MutationConflictError extends Error {
  constructor() {
    super("This operation id was already used with a different request");
    this.name = "MutationConflictError";
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

/** Stable content hash so a replayed operation id can be verified to match its request. */
export function mutationRequestHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

/** Rejects a reused operation id that carries a different payload than the stored one. */
export function assertOperationPayload(storedHash: string | null | undefined, expectedHash: string) {
  if (storedHash && storedHash !== expectedHash) throw new MutationConflictError();
}

export function fixedWindow(now: Date, windowMs: number) {
  if (!Number.isSafeInteger(windowMs) || windowMs <= 0) {
    throw new Error("Invalid rate-limit window");
  }

  const startMs = Math.floor(now.getTime() / windowMs) * windowMs;
  return {
    startMs,
    expiresAt: new Date(startMs + windowMs),
  };
}

export function rateLimitBucketKey(scope: string, actorId: string, startMs: number) {
  return `${scope}:${actorId}:${startMs}`;
}
