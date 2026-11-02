"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertRole } from "@/lib/auth-guard";
import { dbConnect } from "@/lib/db";
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
const requestSchema = z.discriminatedUnion("requestType", [
  z.object({ requestType: z.enum(["ACCESS", "PASSWORD_RESET"]), purpose: z.literal("") }),
  z.object({
    requestType: z.literal("OPENAI_ACCESS"),
    purpose: z.string().trim().min(10, "Briefly describe what you want to build.").max(300),
  }),
]);

export async function createN8nRequestAction(
  _state: N8nActionState,
  formData: FormData,
): Promise<N8nActionState> {
  if (!(await csrfTokenIsValid(formData))) return { error: "Your session expired. Refresh and try again." };
  const guard = await assertRole("STUDENT");
  if (!guard.ok || guard.session.user.role !== "STUDENT") return { error: "Only students can submit this request." };
  const parsed = requestSchema.safeParse({
    requestType: formData.get("requestType"),
    purpose: String(formData.get("purpose") ?? "").trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Choose the help you need." };

  try {
    await consumeRateLimit("n8n.request.create", guard.session.user.id);
    const request = await createN8nRequest(guard.session.user.id, parsed.data.requestType, parsed.data.purpose);
    if (!request) return { error: "You already have an active request of this type." };
    await recordAuditEvent({
      actorId: guard.session.user.id,
      action: "N8N_REQUEST_CREATE",
      resourceType: "N8nAccessRequest",
      resourceId: request._id.toString(),
      result: "SUCCEEDED",
    }, await getRequestContext());
    revalidatePath("/dashboard/n8n-help");
    revalidatePath("/dashboard/n8n-requests");
    revalidatePath("/dashboard/access-requests");
    revalidatePath("/dashboard/issues");
    return { success: "Your request has been sent to the support team." };
  } catch (error) {
    if (error instanceof MutationRateLimitError) return { error: "Too many requests. Please try again later." };
    return { error: "We could not submit your request. Please try again." };
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
    await dbConnect();
    const admin = await UserModel.findById(guard.session.user.id).select("lastLoginAt").lean();
    if (!admin?.lastLoginAt || Date.now() - admin.lastLoginAt.getTime() > 12 * 60 * 60 * 1000) {
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
