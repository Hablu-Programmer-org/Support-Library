"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertRole } from "@/lib/auth-guard";
import { operationIdSchema } from "@/lib/mutation-security";
import { parseVideoLinks } from "@/lib/parse-links";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { addReply, editReply, softDeleteReply } from "@/lib/services/replies";
import {
  formFiles,
  ingestUploads,
  UploadValidationError,
  type IngestedUpload,
} from "@/lib/uploads/ingest";
import { supportReplyInputSchema } from "@/lib/validation";
import { z } from "zod";
import { withCsrfProtection } from "@/lib/safe-action";

const formValue = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

export async function addReplyAction(issueId: string, formData: FormData) {
  return withCsrfProtection(formData, async (formData) => {
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
      const operationId = operationIdSchema.parse(formData.get("operationId"));

      await consumeRateLimit("reply.add", guard.session.user.id, {
        action: "REPLY_CREATE",
        resourceType: "SupportReply",
        resourceId: issueId,
      });
      if (files.length) {
        await consumeRateLimit("attachment.upload", guard.session.user.id);
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
      reply = await addReply(parsed, guard.session.user.id, operationId, uploads);
    } catch (error) {
      if (error instanceof UploadValidationError) throw new Error(error.message);
      throw new Error("Unable to add the response. Please try again later.");
    }
    if (!reply) throw new Error("Issue not found");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/issues");
    revalidatePath(`/dashboard/issues/${issueId}`);
    redirect(`/dashboard/issues/${issueId}`);
  });
}

export async function editReplyAction(issueId: string, replyId: string, formData: FormData) {
  return withCsrfProtection(formData, async (formData) => {
    const guard = await assertRole("ADMIN", "MENTOR");
    if (!guard.ok) redirect("/unauthorized");

    let reply: Awaited<ReturnType<typeof editReply>>;
    try {
      const body = z.string().trim().min(1).max(20_000).parse(formValue(formData, "body"));
      // Same parser as the composer: a non-empty textarea that yields no usable
      // link is a mistake worth reporting, not a silent clear.
      const rawVideoLinks = formValue(formData, "videoLinks");
      const videoLinks = parseVideoLinks(rawVideoLinks);
      if (rawVideoLinks && videoLinks.length === 0) {
        throw new Error(
          "Video links could not be read. Use one per line: title|https://url",
        );
      }

      await consumeRateLimit("reply.edit", guard.session.user.id, {
        action: "REPLY_EDIT",
        resourceType: "SupportReply",
        resourceId: replyId,
      });
      reply = await editReply(
        issueId,
        replyId,
        body,
        guard.session.user.id,
        guard.session.user.role,
        videoLinks,
      );
      if (!reply) throw new Error("Denied");
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Video links could not be read")) {
        throw error;
      }
      throw new Error("Unable to edit the response. Please try again later.");
    }
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/issues");
    revalidatePath(`/dashboard/issues/${issueId}`);
  });
}

export async function deleteReplyAction(issueId: string, replyId: string, formData: FormData) {
  return withCsrfProtection(formData, async () => {
    const guard = await assertRole("ADMIN", "MENTOR");
    if (!guard.ok) redirect("/unauthorized");

    try {
      await consumeRateLimit("reply.delete", guard.session.user.id, {
        action: "REPLY_DELETE",
        resourceType: "SupportReply",
        resourceId: replyId,
      });
      const reply = await softDeleteReply(
        issueId,
        replyId,
        guard.session.user.id,
        guard.session.user.role,
      );
      if (!reply) throw new Error("Denied");
    } catch {
      throw new Error("Unable to delete the response. Please try again later.");
    }
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/issues");
    revalidatePath(`/dashboard/issues/${issueId}`);
  });
}
