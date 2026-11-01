"use server";

import mongoose from "mongoose";

import { assertRole } from "@/lib/auth-guard";
import { currentShift } from "@/lib/config/live-support";
import {
  externalRedirect,
  type ExternalRedirectState,
} from "@/lib/external-redirect";
import { getLiveSupportConfig } from "@/lib/live-support";
import { getRequestContext } from "@/lib/request-context";
import { withCsrfProtection } from "@/lib/safe-action";
import { recordAuditEvent } from "@/lib/services/audit";
import { recordLiveSupportJoin } from "@/lib/services/live-support-joins";
import {
  MutationRateLimitError,
  RateLimitUnavailableError,
  consumeRateLimit,
} from "@/lib/services/rate-limit";
import { buildEligibleIssueFilter } from "@/lib/live-support-policy";
import { SupportIssueModel } from "@/models";

/** Kept for existing imports; the shape is the shared external-redirect state. */
export type JoinLiveSupportState = ExternalRedirectState;

const CLOSED = "Live support is closed right now. Please join during a support slot.";
const NO_REQUEST =
  "This request can no longer be taken to live support. Submit a new request and try again.";
const GENERIC = "We could not open the live support room. Please try again.";
const RATE_LIMITED = "Too many attempts. Please wait a few minutes and try again.";
const NOT_CONFIGURED = "Live support is not available right now. Please try again later.";

/**
 * The room URL, resolved only after every check has passed.
 *
 * Production refuses to boot without it (see `lib/env.ts`); this guard covers a
 * development or self-hosted instance whose room was never configured. The URL
 * is handed back through `externalRedirect`, which rejects anything that is not
 * absolute HTTPS, so a bad value can never become a clickable destination.
 */
function resolveJoinUrl(): string | null {
  return getLiveSupportConfig().joinUrl;
}

const readIssueId = (formData: FormData): string | null => {
  const value = formData.get("issueId");
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return mongoose.isValidObjectId(trimmed) ? trimmed : null;
};

/**
 * Walk into the live support room *with* one of the student's own requests.
 *
 * Everything that matters is decided here, not in the browser:
 *  - a student must own at least one unresolved request (ownership is re-checked
 *    against the session, so a tampered `issueId` is just a denial);
 *  - the room must be inside a support shift, resolved in Asia/Dhaka on the
 *    server (the client clock is display only);
 *  - the join is rate-limited, audited and idempotent per request per day.
 *
 * It deliberately **returns** the URL instead of `redirect()`-ing: the client
 * opens it in a new tab (see `components/shared/external-action-form.tsx`), so
 * the student keeps the request page and staff keep the queue open. The URL is
 * only returned after every check, and never enters the initial HTML.
 *
 * Mentors and admins run the session, so they skip the request requirement and
 * are not queued.
 *
 * The whole body is wrapped so a database or infrastructure failure becomes a
 * normal error state — otherwise the caller's pre-opened tab would be orphaned.
 */
export async function joinLiveSupportAction(
  _prevState: ExternalRedirectState,
  formData: FormData,
): Promise<ExternalRedirectState> {
  try {
    return await withCsrfProtection(formData, async (data): Promise<ExternalRedirectState> => {
      // Rank-based, so admin/mentor pass too; the branch below decides the rest.
      const guard = await assertRole("STUDENT");
      if (!guard.ok) {
        return { error: "Sign in again to join live support." };
      }

      const actorId = guard.session.user.id;
      const role = guard.session.user.role;
      const isStaff = role === "ADMIN" || role === "MENTOR";
      const now = new Date();

      const shift = currentShift(now);
      if (shift === "off") {
        return { error: CLOSED };
      }

      if (isStaff) {
        return externalRedirect(resolveJoinUrl(), NOT_CONFIGURED);
      }

      if (role !== "STUDENT") {
        return { error: "Your account cannot join live support." };
      }

      const issueId = readIssueId(data);
      if (!issueId) {
        return { error: NO_REQUEST };
      }

      // Budget first: a tampered or guessed issue id must not buy an unbounded
      // stream of DB reads or DENIED audit rows.
      try {
        await consumeRateLimit("live-support.join", actorId, {
          action: "ISSUE_LIVE_SUPPORT_JOIN",
          resourceType: "SupportIssue",
          resourceId: issueId,
        });
      } catch (error) {
        if (error instanceof MutationRateLimitError) return { error: RATE_LIMITED };
        if (error instanceof RateLimitUnavailableError) return { error: GENERIC };
        throw error;
      }

      const issue = await SupportIssueModel.findOne(
        {
          // Same scope the gate page uses — one query shape for eligibility.
          ...buildEligibleIssueFilter(actorId),
          _id: new mongoose.Types.ObjectId(issueId),
        },
        "lmsUserId",
      ).lean();

      if (!issue) {
        // Denied authorization attempts are audited, but the student only ever
        // sees one generic message (no existence oracle for someone else's case).
        const context = await getRequestContext();
        await recordAuditEvent(
          {
            actorId,
            action: "ISSUE_LIVE_SUPPORT_JOIN",
            resourceType: "SupportIssue",
            resourceId: issueId,
            result: "DENIED",
          },
          context,
        ).catch(() => undefined);
        return { error: NO_REQUEST };
      }

      try {
        await recordLiveSupportJoin({
          issueId,
          studentUserId: actorId,
          lmsUserId: issue.lmsUserId ?? null,
          shift,
          now,
        });
      } catch {
        return { error: GENERIC };
      }

      // Best-effort: the join row is the operational record, so a failed audit
      // write must not tell the student the room is broken.
      const context = await getRequestContext();
      await recordAuditEvent(
        {
          actorId,
          action: "ISSUE_LIVE_SUPPORT_JOIN",
          resourceType: "SupportIssue",
          resourceId: issueId,
          result: "SUCCEEDED",
        },
        context,
      ).catch(() => undefined);

      return externalRedirect(resolveJoinUrl(), NOT_CONFIGURED);
    });
  } catch {
    return { error: GENERIC };
  }
}
