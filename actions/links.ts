"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertRole } from "@/lib/auth-guard";
import { linkSolutionToCase, unlinkSolutionFromCase } from "@/lib/services/links";
import { caseSolutionLinkInputSchema } from "@/lib/validation";

export async function linkSolutionAction(caseId: string, formData: FormData) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  const parsed = caseSolutionLinkInputSchema.parse({
    caseId,
    solutionArticleId: formData.get("solutionArticleId"),
  });

  await linkSolutionToCase(parsed.caseId, parsed.solutionArticleId, guard.session.user.id);
  revalidatePath(`/dashboard/cases/${caseId}`);
}

export async function unlinkSolutionAction(caseId: string, solutionArticleId: string) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  await unlinkSolutionFromCase(caseId, solutionArticleId);
  revalidatePath(`/dashboard/cases/${caseId}`);
}
