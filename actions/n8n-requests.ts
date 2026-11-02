"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertRole } from "@/lib/auth-guard";
import { dbConnect } from "@/lib/db";
import { normalizeEmail } from "@/lib/email";
import { findLmsUserByEmail } from "@/lib/lms";
import { mapLmsRole } from "@/lib/lms-roles";
import { isN8nAdmin, validateAccessLink } from "@/lib/n8n-request-policy";
import { getRequestContext } from "@/lib/request-context";
import { csrfTokenIsValid } from "@/lib/safe-action";
import { recordAuditEvent } from "@/lib/services/audit";
import { sendN8nHelpEmail } from "@/lib/services/n8n-email";
import {
  claimN8nRequest,
  createN8nRequest,
  getN8nRequestType,
  markN8nRequestFailed,
  markN8nRequestSent,
} from "@/lib/services/n8n-requests";
import { consumeRateLimit, MutationRateLimitError } from "@/lib/services/rate-limit";
import { UserModel } from "@/models";

export type N8nActionState = { success?: string; error?: string };
const requestTypeSchema = z.enum(["ACCESS", "PASSWORD_RESET", "OPENAI_ACCESS"]);
const adminCreateSchema = z.object({
  email: z.email().transform((value) => normalizeEmail(value)),
  requestTypes: z.array(requestTypeSchema).min(1).max(3),
});

async function recentlySignedIn(adminId: string) {
  await dbConnect();
  const admin = await UserModel.findById(adminId).select("lastLoginAt").lean();
  return Boolean(admin?.lastLoginAt && Date.now() - admin.lastLoginAt.getTime() <= 12 * 60 * 60 * 1000);
}

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

  try {
    await consumeRateLimit("n8n.request.create", guard.session.user.id);
    const created = [];
    for (const requestType of parsed.data) {
      const request = await createN8nRequest(guard.session.user.id, requestType);
      if (!request) continue;
      created.push(request);
      await recordAuditEvent({
        actorId: guard.session.user.id,
        action: "N8N_REQUEST_CREATE",
        resourceType: "N8nAccessRequest",
        resourceId: request._id.toString(),
        result: "SUCCEEDED",
      }, await getRequestContext());
    }
    if (created.length === 0) return { error: "Every selected access type already has an active request." };
    revalidatePath("/dashboard/n8n-help");
    revalidatePath("/dashboard/n8n-requests");
    revalidatePath("/dashboard/access-requests");
    revalidatePath("/dashboard/issues");
    const skipped = parsed.data.length - created.length;
    return { success: skipped > 0
      ? `${created.length} request(s) sent. ${skipped} active duplicate skipped.`
      : `${created.length} request(s) sent to the support team.` };
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
    return { error: "For security, sign out and sign in again before creating access requests." };
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
    if (!lmsUser.isActive) return { error: "This Hablu Programmer account is inactive." };

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

    const created = [];
    const context = await getRequestContext();
    for (const requestType of parsed.data.requestTypes) {
      const request = await createN8nRequest(
        target._id.toString(),
        requestType,
        undefined,
        guard.session.user.id,
      );
      if (!request) continue;
      created.push(request);
      await recordAuditEvent({
        actorId: guard.session.user.id,
        action: "N8N_REQUEST_CREATE_BY_ADMIN",
        resourceType: "N8nAccessRequest",
        resourceId: request._id.toString(),
        result: "SUCCEEDED",
      }, context);
    }
    if (created.length === 0) return { error: "Every selected type already has an active request for this account." };

    revalidatePath("/dashboard/access-requests");
    revalidatePath("/dashboard/issues");
    revalidatePath("/dashboard/n8n-help");
    const skipped = parsed.data.requestTypes.length - created.length;
    return { success: skipped > 0
      ? `${created.length} request(s) created. ${skipped} active duplicate skipped.`
      : `${created.length} request(s) created for ${parsed.data.email}.` };
  } catch (error) {
    if (error instanceof MutationRateLimitError) return { error: "Too many requests. Try again in a minute." };
    return { error: "The access requests could not be created safely. Please try again." };
  }
}

export async function sendN8nLinkAction(
  _state: N8nActionState,
  formData: FormData,
): Promise<N8nActionState> {
  if (!(await csrfTokenIsValid(formData))) return { error: "Your session expired. Refresh and try again." };
  const guard = await assertRole("ADMIN");
  if (!guard.ok || !(await isN8nAdmin(guard.session.user.email))) return { error: "You do not have permission to send n8n links." };

  const requestId = String(formData.get("requestId") ?? "");
  let link: string;
  try {
    const requestType = await getN8nRequestType(requestId);
    if (!requestType) return { error: "This request no longer exists." };
    link = validateAccessLink(
      String(formData.get("link") ?? ""),
      requestType === "OPENAI_ACCESS" ? "openai" : "n8n",
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Enter a valid n8n link." };
  }

  try {
    if (!(await recentlySignedIn(guard.session.user.id))) {
      return { error: "For security, sign out and sign in again before sending this link." };
    }
    await consumeRateLimit("n8n.email.send", guard.session.user.id);
    const claimed = await claimN8nRequest(requestId, guard.session.user.id);
    if (!claimed) return { error: "This request was already handled or is being processed." };
    if (!claimed.student.isActive) {
      await markN8nRequestFailed(requestId, guard.session.user.id);
      return { error: "This student account is inactive." };
    }

    try {
      await sendN8nHelpEmail({
        to: claimed.student.email,
        studentName: claimed.student.name,
        requestType: claimed.request.requestType,
        link,
      });
    } catch {
      await markN8nRequestFailed(requestId, guard.session.user.id);
      return { error: "Email could not be sent. Check SMTP and retry with a fresh link." };
    }

    await markN8nRequestSent(requestId, guard.session.user.id);
    await recordAuditEvent({
      actorId: guard.session.user.id,
      action: "N8N_LINK_EMAIL_SEND",
      resourceType: "N8nAccessRequest",
      resourceId: requestId,
      result: "SUCCEEDED",
    }, await getRequestContext());
    revalidatePath("/dashboard/n8n-help");
    revalidatePath("/dashboard/n8n-requests");
    revalidatePath("/dashboard/access-requests");
    revalidatePath("/dashboard/issues");
    return { success: "The email was sent and the request status was updated." };
  } catch (error) {
    if (error instanceof MutationRateLimitError) return { error: "Too many send attempts. Try again later." };
    return { error: "The request could not be processed safely. Please try again." };
  }
}
