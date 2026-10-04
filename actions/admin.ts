"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { assertRole } from "@/lib/auth-guard";
import { updateStaffActive, updateStaffRole } from "@/lib/services/staff";
import { USER_ROLES } from "@/models";

export async function updateStaffRoleAction(userId: string, formData: FormData) {
  const guard = await assertRole("ADMIN");
  if (!guard.ok) redirect("/unauthorized");

  const role = z.enum(USER_ROLES).parse(formData.get("role"));
  await updateStaffRole(userId, role);
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/staff");
}

export async function updateStaffActiveAction(userId: string, formData: FormData) {
  const guard = await assertRole("ADMIN");
  if (!guard.ok) redirect("/unauthorized");

  await updateStaffActive(userId, formData.get("isActive") === "true");
  revalidatePath("/dashboard/admin");
  revalidatePath("/dashboard/admin/staff");
}
