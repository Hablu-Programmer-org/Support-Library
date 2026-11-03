"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { FormState } from "@/actions/issues";
import { assertRole } from "@/lib/auth-guard";
import { buildIssueDetailHref, parseIssueListReturnTo } from "@/lib/issue-list-params";
import { MutationConflictError, operationIdSchema } from "@/lib/mutation-security";
import { parseVideoLinks, parseStudentVideoLinksResult } from "@/lib/parse-links";
import { linkLimit } from "@/lib/validation/common";
import { canMutate } from "@/lib/roles";
import { csrfTokenIsValid } from "@/lib/safe-action";
import { getRequestContext } from "@/lib/request-context";
import { recordAuditEvent } from "@/lib/services/audit";
import {
  MutationRateLimitError,
  RateLimitUnavailableError,
  consumeRateLimit,
} from "@/lib/services/rate-limit";
import { addReply, addStudentReply, editReply, softDeleteReply } from "@/lib/services/replies";
import {
  formFiles,
  ingestUploads,
  UploadValidationError,
  type IngestedUpload,
} from "@/lib/uploads/ingest";
import { supportReplyInputSchema } from "@/lib/validation";
import { studentReplyInputSchema } from "@/lib/validation/reply";

/**
 * Reply actions report their failures as form state instead of throwing.
 *
 * Throwing from a server action replaces the whole page with the error boundary
 * ("Something Went Wrong") and loses the text the mentor just wrote — which is
 * exactly what a too-large image, a stale CSRF token, the rate limit or a
 * reused operation id used to do. The action now returns a `FormState`, the
 * composer renders it inline, and the submitted values are echoed back so React's
 * automatic form reset cannot wipe them.
 */
export type ReplyFormState = FormState & {
  /** Echoed back on failure: React resets the form after a form action runs. */
  values?: { body?: string; videoLinks?: string };
};

const SESSION_EXPIRED = "Your session expired. Reload the page and sign in again.";
const RATE_LIMITED = "Too many changes in a short time. Please wait a minute and try again.";
const GENERIC = "Unable to save the response. Please try again.";
const CONFLICT =
  "This form was already submitted with different text. Reload the page and try again.";
const VIDEO_LINKS = "Video links could not be read. Use one per line: title|https://url";

const formValue = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

/**
 * The client generates one operation id per attempt; a request that arrives
 * without a usable one (an older page, a scripted post) must not fail the whole
 * submission over an internal idempotency key, so fall back to a fresh id.
 */
const readOperationId = (formData: FormData) => {
  const parsed = operationIdSchema.safeParse(formData.get("operationId"));
  return parsed.success ? parsed.data : crypto.randomUUID();
};

/**
 * Maps a failure to form state, and logs the real cause server-side.
 *
 * The log line is the only place the underlying error is visible: Next.js
 * masks a server-action error message in production, so without this a support
 * call can never be diagnosed from the UI alone. Nothing sensitive is logged —
 * no reply body, no student identity.
 */
function replyFailure(
  scope: string,
  error: unknown,
  values?: ReplyFormState["values"],
): ReplyFormState {
  console.error(`[replies] ${scope} failed`, error);

  if (error instanceof UploadValidationError) {
    return { fieldErrors: { [error.field]: [error.message] }, values };
  }
  if (error instanceof MutationConflictError) {
    return { fieldErrors: { _form: [CONFLICT] }, values };
  }
  if (error instanceof MutationRateLimitError) {
    return { fieldErrors: { _form: [RATE_LIMITED] }, values };
  }
  if (error instanceof RateLimitUnavailableError) {
    return { fieldErrors: { _form: [GENERIC] }, values };
  }
  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string[]> = {};
    for (const issue of error.issues) {
      const key = issue.path.length ? String(issue.path[0]) : "_form";
      (fieldErrors[key] ??= []).push(issue.message);
    }
    return { fieldErrors, values };
  }
  return { fieldErrors: { _form: [GENERIC] }, values };
}

export async function addReplyAction(
  issueId: string,
  _prevState: ReplyFormState | undefined,
  formData: FormData,
): Promise<ReplyFormState> {
  const values = {
    body: formValue(formData, "body") ?? "",
    videoLinks: formValue(formData, "videoLinks") ?? "",
  };

  if (!(await csrfTokenIsValid(formData))) {
    return { fieldErrors: { _form: [SESSION_EXPIRED] }, values };
  }

  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  const files = formFiles(formData, "uploads");

  let reply: Awaited<ReturnType<typeof addReply>>;
  try {
    const parsed = supportReplyInputSchema.parse({
      issueId,
      body: formValue(formData, "body"),
      videoLinks: parseVideoLinks(formValue(formData, "videoLinks")),
    });
    const operationId = readOperationId(formData);

    try {
      await consumeRateLimit("reply.add", guard.session.user.id, {
        action: "REPLY_CREATE",
        resourceType: "SupportReply",
        resourceId: issueId,
      });
      if (files.length) {
        await consumeRateLimit("attachment.upload", guard.session.user.id);
      }
    } catch (error) {
      if (error instanceof MutationRateLimitError) {
        return { fieldErrors: { _form: [RATE_LIMITED] }, values };
      }
      console.error("[replies] add response rate limit unavailable", error);
      return { fieldErrors: { _form: [GENERIC] }, values };
    }

    let uploads: IngestedUpload[] = [];
    try {
      uploads = await ingestUploads(files, guard.session.user.id);
    } catch (error) {
      // Surface the file problem itself (too large, wrong type, ...) rather than
      // the generic failure, so the user knows what to change.
      if (error instanceof UploadValidationError) throw error;
      throw new Error("Upload failed");
    }

    // `addReply` deletes these objects when the write is a replay, loses the
    // duplicate-key race, or discovers the issue is already gone.
    reply = await addReply(
      parsed,
      guard.session.user.id,
      operationId,
      uploads,
      guard.session.user.role ?? "MENTOR",
    );
  } catch (error) {
    return replyFailure("add response", error, values);
  }
  if (!reply) return { fieldErrors: { _form: ["Issue not found."] }, values };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/issues");
  revalidatePath(`/dashboard/issues/${issueId}`);
  // Keep the list context the case was opened from: the reply must not silently
  // reset the viewer's filters and page.
  redirect(
    buildIssueDetailHref(
      issueId,
      parseIssueListReturnTo(formData.get("returnTo"), {
        canManage: canMutate(guard.session.user.role ?? "STUDENT"),
      }),
    ),
  );
}

export async function addStudentReplyAction(
  issueId: string,
  _prevState: ReplyFormState | undefined,
  formData: FormData,
): Promise<ReplyFormState> {
  const values = {
    body: formValue(formData, "body") ?? "",
    videoLinks: formValue(formData, "videoLinks") ?? "",
  };

  if (!(await csrfTokenIsValid(formData))) {
    return { fieldErrors: { _form: [SESSION_EXPIRED] }, values };
  }

  const guard = await assertRole("STUDENT");
  if (!guard.ok) redirect("/unauthorized");
  if (guard.session.user.role !== "STUDENT") redirect("/unauthorized");

  const files = formFiles(formData, "uploads");

  let reply: Awaited<ReturnType<typeof addStudentReply>>;
  try {
    const rawVideoLinks = formValue(formData, "videoLinks");
    // Bound the raw payload before any parsing work happens.
    if (rawVideoLinks && (rawVideoLinks.length > 20_000 || rawVideoLinks.split("\n").length > 100)) {
      return {
        fieldErrors: {
          videoLinks: ["Too many video links. Add at most 100 lines."],
        },
        values,
      };
    }

    // A valid operation id is mandatory for student follow-ups: it is the only
    // thing that makes a double submit idempotent.
    const rawOperationId = formData.get("operationId");
    const parsedOperationId = operationIdSchema.safeParse(rawOperationId);
    if (!parsedOperationId.success) {
      return {
        fieldErrors: {
          _form: ["This form is out of date. Reload the page and try again."],
        },
        values,
      };
    }
    const operationId = parsedOperationId.data;

    try {
      await consumeRateLimit("reply.add.student", guard.session.user.id, {
        action: "REPLY_CREATE",
        resourceType: "SupportReply",
        resourceId: issueId,
      });
      if (files.length) {
        await consumeRateLimit("attachment.upload", guard.session.user.id);
      }
    } catch (error) {
      if (error instanceof MutationRateLimitError) {
        return { fieldErrors: { _form: [RATE_LIMITED] }, values };
      }
      console.error("[replies] student reply rate limit unavailable", error);
      return { fieldErrors: { _form: [GENERIC] }, values };
    }

    const parsedVideoLinks = parseStudentVideoLinksResult(rawVideoLinks);
    if (rawVideoLinks && parsedVideoLinks.submittedLines > 0 && (parsedVideoLinks.invalidLines.length > 0 || parsedVideoLinks.overflow)) {
      const message = parsedVideoLinks.overflow
        ? `Add at most ${linkLimit()} video links.`
        : "Some video links are invalid. Use title|https://url|timestamp|summary.";
      return {
        fieldErrors: {
          videoLinks: [message],
        },
        values,
      };
    }
    const parsed = studentReplyInputSchema.parse({
      issueId,
      body: formValue(formData, "body"),
      videoLinks: parsedVideoLinks.links,
    });

    let uploads: IngestedUpload[] = [];
    try {
      uploads = await ingestUploads(files, guard.session.user.id);
    } catch (error) {
      if (error instanceof UploadValidationError) throw error;
      throw new Error("Upload failed");
    }

    reply = await addStudentReply(parsed, guard.session.user.id, operationId, uploads);
  } catch (error) {
    return replyFailure("student reply", error, values);
  }

  if (!reply) {
    await recordAuditEvent(
      {
        actorId: guard.session.user.id,
        action: "REPLY_CREATE",
        resourceType: "SupportIssue",
        resourceId: issueId,
        result: "DENIED",
      },
      await getRequestContext(),
    ).catch(() => undefined);
    return {
      fieldErrors: {
        _form: ["This request cannot receive a follow-up reply right now."],
      },
      values,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/issues");
  revalidatePath("/dashboard/my-requests");
  revalidatePath(`/dashboard/issues/${issueId}`);
  redirect(`/dashboard/issues/${issueId}`);
}

export async function editReplyAction(
  issueId: string,
  replyId: string,
  _prevState: ReplyFormState | undefined,
  formData: FormData,
): Promise<ReplyFormState> {
  const values = {
    body: formValue(formData, "body") ?? "",
    videoLinks: formValue(formData, "videoLinks") ?? "",
  };

  if (!(await csrfTokenIsValid(formData))) {
    return { fieldErrors: { _form: [SESSION_EXPIRED] }, values };
  }

  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  try {
    const body = z.string().trim().min(1).max(20_000).parse(formValue(formData, "body"));
    // Same parser as the composer: a non-empty textarea that yields no usable
    // link is a mistake worth reporting, not a silent clear.
    const rawVideoLinks = formValue(formData, "videoLinks");
    const videoLinks = parseVideoLinks(rawVideoLinks);
    if (rawVideoLinks && videoLinks.length === 0) {
      return { fieldErrors: { videoLinks: [VIDEO_LINKS] }, values };
    }

    try {
      await consumeRateLimit("reply.edit", guard.session.user.id, {
        action: "REPLY_EDIT",
        resourceType: "SupportReply",
        resourceId: replyId,
      });
    } catch (error) {
      if (error instanceof MutationRateLimitError) {
        return { fieldErrors: { _form: [RATE_LIMITED] }, values };
      }
      console.error("[replies] edit response rate limit unavailable", error);
      return { fieldErrors: { _form: [GENERIC] }, values };
    }

    const reply = await editReply(
      issueId,
      replyId,
      body,
      guard.session.user.id,
      guard.session.user.role,
      videoLinks,
    );
    if (!reply) {
      return { fieldErrors: { _form: ["This response can no longer be edited."] }, values };
    }
  } catch (error) {
    return replyFailure("edit response", error, values);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/issues");
  revalidatePath(`/dashboard/issues/${issueId}`);
  return { message: "Response updated." };
}

export async function deleteReplyAction(
  issueId: string,
  replyId: string,
  _prevState: ReplyFormState | undefined,
  formData: FormData,
): Promise<ReplyFormState> {
  if (!(await csrfTokenIsValid(formData))) {
    return { fieldErrors: { _form: [SESSION_EXPIRED] } };
  }

  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  try {
    try {
      await consumeRateLimit("reply.delete", guard.session.user.id, {
        action: "REPLY_DELETE",
        resourceType: "SupportReply",
        resourceId: replyId,
      });
    } catch (error) {
      if (error instanceof MutationRateLimitError) {
        return { fieldErrors: { _form: [RATE_LIMITED] } };
      }
      console.error("[replies] delete response rate limit unavailable", error);
      return { fieldErrors: { _form: [GENERIC] } };
    }

    const reply = await softDeleteReply(
      issueId,
      replyId,
      guard.session.user.id,
      guard.session.user.role,
    );
    if (!reply) {
      return { fieldErrors: { _form: ["This response can no longer be deleted."] } };
    }
  } catch (error) {
    return replyFailure("delete response", error);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/issues");
  revalidatePath(`/dashboard/issues/${issueId}`);
  return { message: "Response deleted." };
}
