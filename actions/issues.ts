"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertRole } from "@/lib/auth-guard";
import { addReply } from "@/lib/services/replies";
import { changeIssueStatus, createIssue, softDeleteIssue, updateIssue } from "@/lib/services/issues";
import { supportIssueInputSchema, supportReplyInputSchema } from "@/lib/validation";
import { CASE_STATUSES, type CaseStatus } from "@/models";

type FormState = {
  fieldErrors?: Record<string, string[]>;
  message?: string;
};

const formValue = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const parseTags = (value?: string) =>
  value
    ?.split(",")
    .map((tag) => tag.trim())
    .filter(Boolean) ?? [];

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

const parseIssueForm = (formData: FormData) =>
  supportIssueInputSchema.parse({
    studentName: formValue(formData, "studentName"),
    studentEmail: formValue(formData, "studentEmail"),
    lmsUserId: formValue(formData, "lmsUserId"),
    title: formValue(formData, "title"),
    question: formValue(formData, "question"),
    status: formValue(formData, "status") ?? "OPEN",
    priority: formValue(formData, "priority") ?? "NORMAL",
    courseSlug: formValue(formData, "courseSlug"),
    batchNo: formValue(formData, "batchNo"),
    moduleSlug: formValue(formData, "moduleSlug"),
    contentSlug: formValue(formData, "contentSlug"),
    tags: parseTags(formValue(formData, "tags")),
  });

export async function createIssueAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) return { fieldErrors: { _form: ["Unauthorized"] } };

  let issueData;
  try {
    issueData = parseIssueForm(formData);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      err.issues.forEach((e) => {
        const path = e.path.join(".");
        fieldErrors[path] = [...(fieldErrors[path] ?? []), e.message];
      });
      return { fieldErrors };
    }
    return { fieldErrors: { _form: ["Invalid form data"] } };
  }

  const solutionBody = formValue(formData, "solutionBody");
  const solutionFileLinks = parseFileLinks(formValue(formData, "solutionFileLinks"));
  const solutionVideoLinks = parseVideoLinks(formValue(formData, "solutionVideoLinks"));
  const solveIssue = formData.get("solveIssue") === "on";

  const hasSolution = Boolean(solutionBody || solutionFileLinks.length || solutionVideoLinks.length);
  const solution = hasSolution
    ? supportReplyInputSchema.omit({ issueId: true }).parse({
        body: solutionBody ?? "See the attached file or video links for the answer.",
        isInternalNote: false,
        fileLinks: solutionFileLinks,
        videoLinks: solutionVideoLinks,
      })
    : null;

  const supportIssue = await createIssue({ ...issueData, status: "OPEN" }, guard.session.user.id);

  if (solution) {
    await addReply({ ...solution, issueId: supportIssue.id }, guard.session.user.id);
  }

  if (solution && solveIssue) {
    await changeIssueStatus(supportIssue.id, "SOLVED", guard.session.user.id);
  }

  revalidatePath("/dashboard/issues");
  revalidatePath("/dashboard");
  redirect(`/dashboard/issues/${supportIssue.id}`);
}

export async function updateIssueAction(id: string, _prevState: FormState, formData: FormData): Promise<FormState> {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) return { fieldErrors: { _form: ["Unauthorized"] } };

  let issueData;
  try {
    issueData = parseIssueForm(formData);
  } catch (err) {
    if (err instanceof z.ZodError) {
      const fieldErrors: Record<string, string[]> = {};
      err.issues.forEach((e) => {
        const path = e.path.join(".");
        fieldErrors[path] = [...(fieldErrors[path] ?? []), e.message];
      });
      return { fieldErrors };
    }
    return { fieldErrors: { _form: ["Invalid form data"] } };
  }

  const supportIssue = await updateIssue(id, issueData, guard.session.user.id);
  if (!supportIssue) return { fieldErrors: { _form: ["Issue not found"] } };

  revalidatePath("/dashboard/issues");
  revalidatePath(`/dashboard/issues/${id}`);
  redirect(`/dashboard/issues/${id}`);
}

export async function changeIssueStatusAction(id: string, _prevState: FormState | undefined, formData: FormData): Promise<FormState> {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) return { fieldErrors: { _form: ["Unauthorized"] } };

  const status = z.enum(CASE_STATUSES).parse(formData.get("status")) as CaseStatus;
  await changeIssueStatus(id, status, guard.session.user.id);
  revalidatePath("/dashboard/issues");
  revalidatePath(`/dashboard/issues/${id}`);
  return { message: "Status updated" };
}

// Backward-compatible wrapper for simple forms (status update, delete)
export async function changeIssueStatusActionSimple(id: string, formData: FormData) {
  const result = await changeIssueStatusAction(id, undefined, formData);
  if (result.fieldErrors) {
    // For simple forms, throw to trigger error boundary or redirect with error
    throw new Error(result.fieldErrors._form?.[0] ?? "Failed to update status");
  }
}

export async function deleteIssueAction(_prevState: FormState | undefined, id: string): Promise<FormState> {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) return { fieldErrors: { _form: ["Unauthorized"] } };

  await softDeleteIssue(id, guard.session.user.id);
  revalidatePath("/dashboard/issues");
  redirect("/dashboard/issues");
}

// Backward-compatible wrapper for simple delete forms
export async function deleteIssueActionSimple(id: string) {
  const result = await deleteIssueAction(undefined, id);
  if (result.fieldErrors) {
    throw new Error(result.fieldErrors._form?.[0] ?? "Failed to delete issue");
  }
}