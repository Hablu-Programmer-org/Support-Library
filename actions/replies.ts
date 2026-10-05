"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertRole } from "@/lib/auth-guard";
import { addReply, editReply, softDeleteReply } from "@/lib/services/replies";
import { supportReplyInputSchema } from "@/lib/validation";

const formValue = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const parseLinkLines = (value?: string) =>
  value
    ?.split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("|").map((part) => part.trim())) ?? [];

const parseFileLinks = (value?: string) =>
  parseLinkLines(value).map(([title, url, type, note]) => ({
    title,
    url,
    type: type || undefined,
    note: note || undefined,
  }));

const parseVideoLinks = (value?: string) =>
  parseLinkLines(value).map(([title, url, timestamp, summary]) => ({
    title,
    url,
    timestamp: timestamp || undefined,
    summary: summary || undefined,
  }));

export async function addReplyAction(caseId: string, formData: FormData) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  const parsed = supportReplyInputSchema.parse({
    caseId,
    body: formValue(formData, "body"),
    isInternalNote: formData.get("isInternalNote") === "true",
    fileLinks: parseFileLinks(formValue(formData, "fileLinks")),
    videoLinks: parseVideoLinks(formValue(formData, "videoLinks")),
  });

  await addReply(parsed, guard.session.user.id);
  revalidatePath(`/dashboard/cases/${caseId}`);
}

export async function editReplyAction(caseId: string, replyId: string, formData: FormData) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  const body = formValue(formData, "body");
  if (body) await editReply(replyId, body, guard.session.user.id, guard.session.user.role);
  revalidatePath(`/dashboard/cases/${caseId}`);
}

export async function deleteReplyAction(caseId: string, replyId: string) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  await softDeleteReply(replyId, guard.session.user.id, guard.session.user.role);
  revalidatePath(`/dashboard/cases/${caseId}`);
}
