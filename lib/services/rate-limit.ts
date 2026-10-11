import "server-only";

import { dbConnect } from "@/lib/db";
import { fixedWindow, rateLimitBucketKey } from "@/lib/mutation-security";
import { RateLimitBucketModel } from "@/models";
import { recordAuditEvent, type AuditAction, type AuditResourceType } from "./audit";
import { getRequestContext } from "@/lib/request-context";

export type RateLimitScope =
  | "lms.lookup"
  | "issue.create"
  | "issue.update"
  | "issue.status"
  | "issue.archive"
  | "issue.publish"
  | "issue.unpublish"
  | "reply.add"
  | "reply.edit"
  | "reply.delete"
  | "oauth.callback";

const RATE_LIMITS: Record<RateLimitScope, { limit: number; windowMs: number }> = {
  "lms.lookup": { limit: 30, windowMs: 60_000 },
  "issue.create": { limit: 10, windowMs: 60_000 },
  "issue.update": { limit: 30, windowMs: 60_000 },
  "issue.status": { limit: 30, windowMs: 60_000 },
  "issue.archive": { limit: 10, windowMs: 60_000 },
  "issue.publish": { limit: 20, windowMs: 60_000 },
  "issue.unpublish": { limit: 20, windowMs: 60_000 },
  "reply.add": { limit: 30, windowMs: 60_000 },
  "reply.edit": { limit: 30, windowMs: 60_000 },
  "reply.delete": { limit: 30, windowMs: 60_000 },
  "oauth.callback": { limit: 10, windowMs: 60_000 },
};

export class MutationRateLimitError extends Error {
  constructor() {
    super("Mutation request could not be processed");
    this.name = "MutationRateLimitError";
  }
}

/**
 * Consume rate limit by scope and actor ID (for authenticated users)
 */
export async function consumeRateLimit(
  scope: RateLimitScope,
  actorId: string,
  deniedAudit?: {
    action: AuditAction;
    resourceType: AuditResourceType;
    resourceId: string;
  },
) {
  try {
    await dbConnect();
    const config = RATE_LIMITS[scope];
    const window = fixedWindow(new Date(), config.windowMs);
    const bucket = await RateLimitBucketModel.findOneAndUpdate(
      { key: rateLimitBucketKey(scope, actorId, window.startMs) },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: window.expiresAt },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    if (!bucket || bucket.count > config.limit) {
      if (deniedAudit) {
        const context = await getRequestContext();
        await recordAuditEvent({
          actorId,
          ...deniedAudit,
          result: "DENIED",
        }, context);
      }
      throw new MutationRateLimitError();
    }
  } catch (error) {
    if (error instanceof MutationRateLimitError) throw error;
    throw new MutationRateLimitError();
  }
}

/**
 * Consume rate limit by custom key (for IP-based rate limiting)
 */
export async function consumeRateLimitByKey(
  scope: RateLimitScope,
  key: string,
  deniedAudit?: {
    action: AuditAction;
    resourceType: AuditResourceType;
    resourceId: string;
  },
) {
  try {
    await dbConnect();
    const config = RATE_LIMITS[scope];
    const window = fixedWindow(new Date(), config.windowMs);
    const bucketKey = `${scope}:${key}:${window.startMs}`;
    const bucket = await RateLimitBucketModel.findOneAndUpdate(
      { key: bucketKey },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: window.expiresAt },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    ).lean();

    if (!bucket || bucket.count > config.limit) {
      if (deniedAudit) {
        // For IP-based rate limiting, we don't have an actorId, so we skip audit
        // await recordAuditEvent({ ... });
      }
      throw new MutationRateLimitError();
    }
  } catch (error) {
    if (error instanceof MutationRateLimitError) throw error;
    throw new MutationRateLimitError();
  }
}