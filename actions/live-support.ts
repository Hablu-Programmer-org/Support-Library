"use server";

import mongoose from "mongoose";
import { redirect } from "next/navigation";

import { assertRole } from "@/lib/auth-guard";
import { currentShift } from "@/lib/config/live-support";
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

export type JoinLiveSupportState = { error?: string };

const CLOSED = "Live support is closed right now. Please join during a support slot.";
const NO_REQUEST =
  "This request can no longer be taken to live support. Submit a new request and try again.";
const GENERIC = "We could not open the live support room. Please try again.";
const RATE_LIMITED = "Too many attempts. Please wait a few minutes and try again.";

/** Audit anchor for the temporary request-less join (no issue is involved). */
const QUICK_JOIN_RESOURCE_ID = "quick-join";

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
 *  - the join is rate-limited, audited and idempotent per request per day;
 *  - the Zoom URL is only resolved after those checks and is never sent to a
 *    browser before it is allowed to be.
 *
 * Mentors and admins run the session, so they skip the request requirement and
 * are not queued.
 */
export async function joinLiveSupportAction(
  _prevState: JoinLiveSupportState,
  formData: FormData,
): Promise<JoinLiveSupportState> {
  return withCsrfProtection(formData, async (data) => {
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
      redirect(getLiveSupportConfig().joinUrl);
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

    redirect(getLiveSupportConfig().joinUrl);
  });
}

/**
 * TEMPORARY (owner request): walk into the room **without** a request.
 *
 * Students were asking for live support before they had submitted anything, so
 * the request-first gate left them with nowhere to click. This shortcut lives
 * next to "Submit an issue" on the issues page, explains that a request is the
 * right first step, and then still lets them in.
 *
 * It is deliberately still narrow, so removing it later is the only thing that
 * has to happen:
 *  - CSRF, session, active-status and role are checked;
 *  - the shift is resolved on the server (Asia/Dhaka), never from the browser;
 *  - the shared `live-support.join` budget applies;
 *  - the join is audited as `LIVE_SUPPORT_QUICK_JOIN`;
 *  - the room URL is resolved only after those checks, so it is not in the HTML.
 *
 * Known gaps (accepted for a temporary feature): no request is recorded, so the
 * student does not appear in the staff queue, and the "one join per request per
 * shift" idempotency key does not apply. Delete this action together with
 * `components/live-support/quick-live-support-button.tsx` (and the audit pair)
 * once requests are the only way in. Search for `TEMPORARY quick join`.
 */
export async function joinLiveSupportQuickAction(
  _prevState: JoinLiveSupportState,
  formData: FormData,
): Promise<JoinLiveSupportState> {
  return withCsrfProtection(formData, async () => {
    const guard = await assertRole("STUDENT");
    if (!guard.ok) {
      return { error: "Sign in again to join live support." };
    }

    // Staff run the session from `/dashboard/support`; this shortcut is for the
    // students who have no page of their own to join from.
    if (guard.session.user.role !== "STUDENT") {
      return { error: "Staff should join from the Live support page." };
    }

    const actorId = guard.session.user.id;

    if (currentShift(new Date()) === "off") {
      return { error: CLOSED };
    }

    try {
      await consumeRateLimit("live-support.join", actorId, {
        action: "LIVE_SUPPORT_QUICK_JOIN",
        resourceType: "LiveSupportQuickJoin",
        resourceId: QUICK_JOIN_RESOURCE_ID,
      });
    } catch (error) {
      if (error instanceof MutationRateLimitError) return { error: RATE_LIMITED };
      if (error instanceof RateLimitUnavailableError) return { error: GENERIC };
      throw error;
    }

    // Best-effort, like the request-backed join: a failed audit must not tell
    // the student the room is broken.
    const context = await getRequestContext();
    await recordAuditEvent(
      {
        actorId,
        action: "LIVE_SUPPORT_QUICK_JOIN",
        resourceType: "LiveSupportQuickJoin",
        resourceId: QUICK_JOIN_RESOURCE_ID,
        result: "SUCCEEDED",
      },
      context,
    ).catch(() => undefined);

    redirect(getLiveSupportConfig().joinUrl);
  });
}
