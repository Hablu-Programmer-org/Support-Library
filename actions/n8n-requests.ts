"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertRole } from "@/lib/auth-guard";
import { dbConnect } from "@/lib/db";
import { normalizeEmail } from "@/lib/email";
import { findLmsUserByEmail, getAgentEnrollment } from "@/lib/lms";
import { mapLmsRole } from "@/lib/lms-roles";
import { isN8nAdmin, validateAccessLink } from "@/lib/n8n-request-policy";
import { describeQueueEmailFailure, summarizeCreateAttempt } from "@/lib/access-request-messages";
import { getRequestContext } from "@/lib/request-context";
import { recentlySignedIn } from "@/lib/recent-auth";
import { csrfTokenIsValid } from "@/lib/safe-action";
import { recordAuditEvent } from "@/lib/services/audit";
import { authorizeToolAccessDecision } from "@/lib/tool-access-authorization";
import {
  queueAccessApprovalEmail,
  queueRejectionEmailRetry,
} from "@/lib/services/access-email-outbox";
import {
  createN8nRequests,
  getStudentAgentEnrollment,
  rejectN8nRequest,
} from "@/lib/services/n8n-requests";
import { consumeRateLimit, MutationRateLimitError } from "@/lib/services/rate-limit";
import { UserModel } from "@/models";
import { ACCESS_REJECTION_REASONS } from "@/models/n8n-access-request";

export type N8nActionState = {
  success?: string;
  error?: string;
  warning?: string;
  errorCode?: "REAUTH_REQUIRED";
};
const requestTypeSchema = z.enum(["ACCESS", "PASSWORD_RESET", "OPENAI_ACCESS"]);
const adminCreateSchema = z.object({
  email: z.email().transform((value) => normalizeEmail(value)),
  requestTypes: z.array(requestTypeSchema).min(1).max(3),
});
const rejectRequestSchema = z.object({
  requestId: z.string().regex(/^[a-f\d]{24}$/i),
  reason: z.enum(ACCESS_REJECTION_REASONS),
  note: z.string().trim().max(300).optional(),
});
const requestIdSchema = z.string().regex(/^[a-f\d]{24}$/i);

export async function createN8nRequestAction(
  _state: N8nActionState,
  formData: FormData,
): Promise<N8nActionState> {
  if (!(await csrfTokenIsValid(formData))) return { error: "Your session expired. Refresh and try again." };
  const guard = await assertRole("STUDENT");
  if (!guard.ok || guard.session.user.role !== "STUDENT") return { error: "Only students can submit this request." };
  const rawTypes = formData.getAll("requestTypes").length > 0
    ? formData.getAll("requestTypes")
    : [formData.get("requestType")];
  const parsed = z.array(requestTypeSchema).min(1).max(3).safeParse([...new Set(rawTypes)]);
  if (!parsed.success) return { error: "Choose at least one access request." };

  const enrollment = await getStudentAgentEnrollment(guard.session.user.id);
  if (!enrollment.enrolled || enrollment.blocked || enrollment.batchNo === null) {
    return { error: "These tools are only for students enrolled in the AI Agent course." };
  }

  try {
    await consumeRateLimit("n8n.request.create", guard.session.user.id);
    const result = await createN8nRequests({
      studentId: guard.session.user.id,
      requestTypes: parsed.data,
    });
    const context = await getRequestContext();
    for (const request of result.created) {
      await recordAuditEvent({
        actorId: guard.session.user.id,
        action: "N8N_REQUEST_CREATE",
        resourceType: "N8nAccessRequest",
        resourceId: request._id.toString(),
        result: "SUCCEEDED",
      }, context);
    }
    const summary = summarizeCreateAttempt({
      createdTypes: result.created.map((request) => request.requestType),
      skipped: result.skipped,
      audience: "STUDENT",
    });
    if (result.created.length === 0) {
      return { error: summary.error ?? "We could not submit your request. Please try again." };
    }
    revalidatePath("/dashboard/access-requests");
    revalidatePath("/dashboard/issues");
    return summary;
  } catch (error) {
    if (error instanceof MutationRateLimitError) return { error: "Too many requests. Please try again later." };
    return { error: "We could not submit your request. Please try again." };
  }
}

export async function createAccessRequestsForStudentAction(
  _state: N8nActionState,
  formData: FormData,
): Promise<N8nActionState> {
  if (!(await csrfTokenIsValid(formData))) return { error: "Your session expired. Refresh and try again." };
  const guard = await assertRole("ADMIN");
  if (!guard.ok || !(await isN8nAdmin(guard.session.user.email))) {
    return { error: "You do not have permission to create access requests." };
  }
  if (!(await recentlySignedIn(guard.session.user.id))) {
    return { error: "Verify with Google to continue.", errorCode: "REAUTH_REQUIRED" };
  }

  const parsed = adminCreateSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    requestTypes: [...new Set(formData.getAll("requestTypes"))],
  });
  if (!parsed.success) return { error: "Enter a valid student email and choose at least one access type." };

  try {
    await consumeRateLimit("n8n.request.create.admin", guard.session.user.id);
    const lmsUser = await findLmsUserByEmail(parsed.data.email);
    if (!lmsUser) return { error: "No Hablu Programmer account was found with this email." };
    const enrollment = await getAgentEnrollment(parsed.data.email);
    if (!enrollment.enrolled || enrollment.blocked || enrollment.batchNo === null) {
      return { error: "This student is not enrolled in the AI Agent course." };
    }
    if (!lmsUser.isActive) return { error: "This Hablu Programmer account is inactive." };
    if (mapLmsRole(lmsUser.role) !== "STUDENT") {
      return { error: "Access requests can only be created for learner accounts." };
    }

    await dbConnect();
    const target = await UserModel.findOneAndUpdate(
      { email: normalizeEmail(lmsUser.email) },
      {
        $set: {
          name: lmsUser.name || lmsUser.email,
          image: lmsUser.image,
          role: mapLmsRole(lmsUser.role),
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    if (!target) return { error: "The account could not be prepared. Please try again." };

    const created = await createN8nRequests({
      studentId: target._id.toString(),
      requestTypes: parsed.data.requestTypes,
      createdBy: guard.session.user.id,
    });
    const context = await getRequestContext();
    for (const request of created.created) {
      await recordAuditEvent({
        actorId: guard.session.user.id,
        action: "N8N_REQUEST_CREATE_BY_ADMIN",
        resourceType: "N8nAccessRequest",
        resourceId: request._id.toString(),
        result: "SUCCEEDED",
      }, context);
    }
    const summary = summarizeCreateAttempt({
      createdTypes: created.created.map((request) => request.requestType),
      skipped: created.skipped,
      audience: "ADMIN",
      email: parsed.data.email,
    });
    if (created.created.length === 0) {
      return { error: summary.error ?? "The access requests could not be created safely. Please try again." };
    }

    revalidatePath("/dashboard/access-requests");
    revalidatePath("/dashboard/issues");
    return summary;
  } catch (error) {
    if (error instanceof MutationRateLimitError) return { error: "Too many requests. Try again in a minute." };
    return { error: "The access requests could not be created safely. Please try again." };
  }
}

export async function sendN8nLinkAction(
  _state: N8nActionState,
  formData: FormData,
): Promise<N8nActionState> {
  const authorization = await authorizeToolAccessDecision(formData);
  if (!authorization.ok) return authorization.state;

  const requestId = String(formData.get("requestId") ?? "");
  let link: string;
  try {
    link = validateAccessLink(String(formData.get("link") ?? ""), "n8n");
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enter a valid n8n link." };
  }

  try {
    await consumeRateLimit("n8n.email.send", authorization.actor.id);
    const queued = await queueAccessApprovalEmail({
      requestId,
      adminId: authorization.actor.id,
      expectedTypes: ["ACCESS", "PASSWORD_RESET"],
      link,
      context: authorization.context,
    });
    if (!queued.ok) {
      return { error: describeQueueEmailFailure(queued.code, queued.requestType) };
    }
    revalidatePath("/dashboard/access-requests");
    revalidatePath("/dashboard/issues");
    return { success: "Decision saved. Email queued for delivery." };
  } catch (error) {
    if (error instanceof MutationRateLimitError) return { error: "Too many send attempts. Try again later." };
    return { error: "The request could not be processed safely. Please try again." };
  }
}

/**
 * OpenAI access needs no invitation link from us: the admin copies the student's
 * address into the OpenAI dashboard, OpenAI sends its own invitation, and this
 * action only confirms it and emails the student.
 *
 * The request type is re-checked server-side so this no-link path can never be
 * used to mark an n8n request as sent without a link.
 */
export async function confirmOpenAiAccessAction(
  _state: N8nActionState,
  formData: FormData,
): Promise<N8nActionState> {
  const authorization = await authorizeToolAccessDecision(formData);
  if (!authorization.ok) return authorization.state;

  const requestId = String(formData.get("requestId") ?? "");
  if (formData.get("confirmed") !== "yes") {
    return { error: "Confirm that you added the exact student email in OpenAI." };
  }

  try {
    await consumeRateLimit("n8n.email.send", authorization.actor.id);
    const queued = await queueAccessApprovalEmail({
      requestId,
      adminId: authorization.actor.id,
      expectedTypes: ["OPENAI_ACCESS"],
      context: authorization.context,
    });
    if (!queued.ok) {
      return { error: describeQueueEmailFailure(queued.code, queued.requestType) };
    }
    revalidatePath("/dashboard/access-requests");
    revalidatePath("/dashboard/issues");
    return { success: "Decision saved. Confirmation email queued." };
  } catch (error) {
    if (error instanceof MutationRateLimitError) return { error: "Too many attempts. Try again later." };
    return { error: "The request could not be confirmed safely. Please try again." };
  }
}

export async function rejectAccessRequestAction(
  _state: N8nActionState,
  formData: FormData,
): Promise<N8nActionState> {
  const authorization = await authorizeToolAccessDecision(formData);
  if (!authorization.ok) return authorization.state;
  const parsed = rejectRequestSchema.safeParse({
    requestId: String(formData.get("requestId") ?? ""),
    reason: String(formData.get("reason") ?? ""),
    note: String(formData.get("note") ?? "") || undefined,
  });
  if (!parsed.success) {
    return { error: "Choose a rejection reason and keep the internal note under 300 characters." };
  }

  try {
    await consumeRateLimit("access.request.decision", authorization.actor.id, {
      action: "ACCESS_REQUEST_REJECT",
      resourceType: "N8nAccessRequest",
      resourceId: parsed.data.requestId,
    });
    // Consume the email budget before the transaction. A rate-limit failure must
    // never commit a rejection whose promised notification was not attempted.
    await consumeRateLimit("n8n.email.send", authorization.actor.id);
    const rejected = await rejectN8nRequest({
      requestId: parsed.data.requestId,
      adminId: authorization.actor.id,
      reason: parsed.data.reason,
      note: parsed.data.note,
      context: authorization.context,
    });
    if (!rejected) {
      return { error: "This request was already handled or is being processed. Refresh to see its latest status." };
    }

    revalidatePath("/dashboard/access-requests");
    revalidatePath("/dashboard/issues");

    if (!rejected.student?.email) {
      return {
        success: "Request rejected.",
        warning: "The student account has no deliverable email, so no notification was sent.",
      };
    }

    return { success: "Request rejected. Notification email queued." };
  } catch (error) {
    if (error instanceof MutationRateLimitError) {
      return { error: "Too many decisions in a short time. Try again later." };
    }
    return { error: "The request could not be rejected safely. Please try again." };
  }
}

export async function retryRejectionEmailAction(
  _previous: N8nActionState,
  formData: FormData,
): Promise<N8nActionState> {
  const authorization = await authorizeToolAccessDecision(formData);
  if (!authorization.ok) return authorization.state;
  const parsed = requestIdSchema.safeParse(String(formData.get("requestId") ?? ""));
  if (!parsed.success) return { error: "Invalid request." };

  try {
    await consumeRateLimit("access.request.decision", authorization.actor.id, {
      action: "ACCESS_REJECTION_EMAIL_RETRY",
      resourceType: "N8nAccessRequest",
      resourceId: parsed.data,
    });
    await consumeRateLimit("n8n.email.send", authorization.actor.id);
    const queued = await queueRejectionEmailRetry({
      requestId: parsed.data,
      adminId: authorization.actor.id,
      context: authorization.context,
    });
    if (!queued) return { error: "This notification is no longer retryable. Refresh the queue." };
    revalidatePath("/dashboard/access-requests");
    return { success: "Rejection notification queued again." };
  } catch (error) {
    if (error instanceof MutationRateLimitError) return { error: error.message };
    return { error: "Notification could not be queued. Try again." };
  }
}
