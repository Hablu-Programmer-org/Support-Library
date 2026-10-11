"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertRole } from "@/lib/auth-guard";
import { parseFileLinks, parseVideoLinks } from "@/lib/parse-links";
import { addReply } from "@/lib/services/replies";
import {
  changeIssueStatus,
  createIssue,
  publishIssue,
  softDeleteIssue,
  unpublishIssue,
  updateIssue,
} from "@/lib/services/issues";
import { supportIssueInputSchema, supportReplyInputSchema } from "@/lib/validation";
import { CASE_STATUSES, type CaseStatus } from "@/models";

export type FormState = {
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

const initialReplySchema = supportReplyInputSchema.omit({ issueId: true });

const zodFieldErrors = (
  error: z.ZodError,
  fieldNames: Record<string, string> = {},
) => {
  const fieldErrors: Record<string, string[]> = {};
  error.issues.forEach((issue) => {
    const root = String(issue.path[0] ?? "_form");
    const path = fieldNames[root] ?? root;
    fieldErrors[path] = [...(fieldErrors[path] ?? []), issue.message];
  });
  return fieldErrors;
};

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
      return { fieldErrors: zodFieldErrors(err) };
    }
    return { fieldErrors: { _form: ["Invalid form data"] } };
  }

  const solutionBody = formValue(formData, "solutionBody");
  const solutionFileLinks = parseFileLinks(formValue(formData, "solutionFileLinks"));
  const solutionVideoLinks = parseVideoLinks(formValue(formData, "solutionVideoLinks"));
  const solveIssue = formData.get("solveIssue") === "on";

  const hasSolution = Boolean(solutionBody || solutionFileLinks.length || solutionVideoLinks.length);
  let solution: z.infer<typeof initialReplySchema> | null;
  try {
    solution = hasSolution
      ? initialReplySchema.parse({
          body: solutionBody ?? "See the attached file or video links for the answer.",
          fileLinks: solutionFileLinks,
          videoLinks: solutionVideoLinks,
        })
      : null;
  } catch (err) {
    if (err instanceof z.ZodError) {
      return {
        fieldErrors: zodFieldErrors(err, {
          body: "solutionBody",
          fileLinks: "solutionFileLinks",
          videoLinks: "solutionVideoLinks",
        }),
      };
    }
    return { fieldErrors: { _form: ["Invalid answer data"] } };
  }

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
      return { fieldErrors: zodFieldErrors(err) };
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
  if (status === "ARCHIVED") {
    return { fieldErrors: { status: ["Use the Archive issue action instead"] } };
  }
  const supportIssue = await changeIssueStatus(id, status, guard.session.user.id);
  if (!supportIssue) return { fieldErrors: { _form: ["Issue not found"] } };
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

  const supportIssue = await softDeleteIssue(id, guard.session.user.id);
  if (!supportIssue) return { fieldErrors: { _form: ["Issue not found"] } };
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

export async function publishIssueAction(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const guard = await assertRole("ADMIN");
  if (!guard.ok) return { fieldErrors: { _form: ["Unauthorized"] } };

  const reviewedAt = formData.get("reviewedAt");
  const reviewConfirmed = formData.get("reviewConfirmed");

  if (reviewConfirmed !== "true") {
    return { fieldErrors: { reviewConfirmed: ["Please confirm you have reviewed the issue for student personal information"] } };
  }

  const parsedReviewedAt = z.string().datetime().safeParse(reviewedAt);
  if (!parsedReviewedAt.success) return { fieldErrors: { _form: ["Invalid issue revision"] } };

  const supportIssue = await publishIssue(
    id,
    guard.session.user.id,
    new Date(parsedReviewedAt.data),
  );
  if (!supportIssue) return { fieldErrors: { _form: ["Issue changed since review. Refresh and review it again."] } };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/issues");
  revalidatePath(`/dashboard/issues/${id}`);
  redirect(`/dashboard/issues/${id}`);
}

export async function unpublishIssueAction(id: string) {
  const guard = await assertRole("ADMIN");
  if (!guard.ok) redirect("/unauthorized");

  const supportIssue = await unpublishIssue(id, guard.session.user.id);
  if (!supportIssue) throw new Error("Issue not found");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/issues");
  revalidatePath(`/dashboard/issues/${id}`);
  redirect(`/dashboard/issues/${id}`);
}
