"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertRole } from "@/lib/auth-guard";
import { createSolution, publishSolution, softDeleteSolution, updateSolution } from "@/lib/services/solutions";
import { solutionArticleInputSchema } from "@/lib/validation";

const formValue = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const parseTags = (value?: string) =>
  value?.split(",").map((tag) => tag.trim()).filter(Boolean) ?? [];

const parseLinkLines = (value?: string) =>
  value?.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => line.split("|").map((part) => part.trim())) ?? [];

const parseFileLinks = (value?: string) =>
  parseLinkLines(value).map(([title, url, type, note]) => ({ title, url, type: type || undefined, note: note || undefined }));

const parseVideoLinks = (value?: string) =>
  parseLinkLines(value).map(([title, url, timestamp, summary]) => ({ title, url, timestamp: timestamp || undefined, summary: summary || undefined }));

const parseSolutionForm = (formData: FormData) =>
  solutionArticleInputSchema.parse({
    title: formValue(formData, "title"),
    slug: formValue(formData, "slug"),
    summary: formValue(formData, "summary"),
    body: formValue(formData, "body"),
    tags: parseTags(formValue(formData, "tags")),
    visibility: formValue(formData, "visibility") ?? "INTERNAL",
    fileLinks: parseFileLinks(formValue(formData, "fileLinks")),
    videoLinks: parseVideoLinks(formValue(formData, "videoLinks")),
  });

export async function createSolutionAction(formData: FormData) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  const solution = await createSolution(parseSolutionForm(formData), guard.session.user.id);
  revalidatePath("/dashboard/solutions");
  redirect(`/dashboard/solutions/${solution.slug}`);
}

export async function updateSolutionAction(slug: string, formData: FormData) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  const solution = await updateSolution(slug, parseSolutionForm(formData), guard.session.user.id);
  if (!solution) redirect("/dashboard/solutions");

  revalidatePath("/dashboard/solutions");
  revalidatePath(`/dashboard/solutions/${slug}`);
  redirect(`/dashboard/solutions/${solution.slug}`);
}

export async function deleteSolutionAction(slug: string) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  await softDeleteSolution(slug, guard.session.user.id);
  revalidatePath("/dashboard/solutions");
  redirect("/dashboard/solutions");
}

export async function publishSolutionAction(slug: string) {
  const guard = await assertRole("ADMIN");
  if (!guard.ok) redirect("/unauthorized");

  await publishSolution(slug, guard.session.user.id);
  revalidatePath("/dashboard/solutions");
  revalidatePath(`/dashboard/solutions/${slug}`);
}
