"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertRole } from "@/lib/auth-guard";
import { addReply } from "@/lib/services/replies";
import { changeCaseStatus, createCase, softDeleteCase, updateCase } from "@/lib/services/cases";
import { supportCaseInputSchema, supportReplyInputSchema } from "@/lib/validation";
import { CASE_STATUSES, type CaseStatus } from "@/models";

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

const parseCaseForm = (formData: FormData) =>
  supportCaseInputSchema.parse({
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

export async function createCaseAction(formData: FormData) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  const caseData = parseCaseForm(formData);

  // If solution provided, create it as the first reply
  const solutionBody = formValue(formData, "solutionBody");
  const solutionFileLinks = parseFileLinks(formValue(formData, "solutionFileLinks"));
  const solutionVideoLinks = parseVideoLinks(formValue(formData, "solutionVideoLinks"));
  const solveCase = formData.get("solveCase") === "on";

  const hasSolution = Boolean(solutionBody || solutionFileLinks.length || solutionVideoLinks.length);
  // Validate attachments before writing the case, including attachment-only answers.
  const solution = hasSolution
    ? supportReplyInputSchema.omit({ caseId: true }).parse({
        body: solutionBody ?? "See the attached file or video links for the answer.",
        isInternalNote: false,
        fileLinks: solutionFileLinks,
        videoLinks: solutionVideoLinks,
      })
    : null;
  const supportCase = await createCase({ ...caseData, status: "OPEN" }, guard.session.user.id);

  if (solution) {
    await addReply({ ...solution, caseId: supportCase.id }, guard.session.user.id);
  }

  if (solution && solveCase) {
    await changeCaseStatus(supportCase.id, "SOLVED", guard.session.user.id);
  }

  revalidatePath("/dashboard/cases");
  revalidatePath("/dashboard");
  redirect(`/dashboard/cases/${supportCase.id}`);
}

export async function updateCaseAction(id: string, formData: FormData) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  const supportCase = await updateCase(id, parseCaseForm(formData), guard.session.user.id);
  if (!supportCase) redirect("/dashboard/cases");

  revalidatePath("/dashboard/cases");
  revalidatePath(`/dashboard/cases/${id}`);
  redirect(`/dashboard/cases/${id}`);
}

export async function changeCaseStatusAction(id: string, formData: FormData) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  const status = z.enum(CASE_STATUSES).parse(formData.get("status")) as CaseStatus;
  await changeCaseStatus(id, status, guard.session.user.id);
  revalidatePath("/dashboard/cases");
  revalidatePath(`/dashboard/cases/${id}`);
}

export async function deleteCaseAction(id: string) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  await softDeleteCase(id, guard.session.user.id);
  revalidatePath("/dashboard/cases");
  redirect("/dashboard/cases");
}
