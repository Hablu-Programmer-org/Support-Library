"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertRole } from "@/lib/auth-guard";
import { changeCaseStatus, createCase, softDeleteCase, updateCase } from "@/lib/services/cases";
import { supportCaseInputSchema } from "@/lib/validation";
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

  const supportCase = await createCase(parseCaseForm(formData), guard.session.user.id);
  revalidatePath("/dashboard/cases");
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
