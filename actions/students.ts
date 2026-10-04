"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertRole } from "@/lib/auth-guard";
import { createStudent, updateStudent } from "@/lib/services/students";
import { studentRefInputSchema } from "@/lib/validation";

const formValue = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
};

const parseStudentForm = (formData: FormData) =>
  studentRefInputSchema.parse({
    name: formValue(formData, "name"),
    studentId: formValue(formData, "studentId"),
    lmsUserId: formValue(formData, "lmsUserId"),
    email: formValue(formData, "email"),
    phone: formValue(formData, "phone"),
  });

export async function createStudentAction(formData: FormData) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  const student = await createStudent(parseStudentForm(formData), guard.session.user.id);
  revalidatePath("/dashboard/students");
  redirect(`/dashboard/students/${student.id}`);
}

export async function updateStudentAction(id: string, formData: FormData) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) redirect("/unauthorized");

  const student = await updateStudent(id, parseStudentForm(formData), guard.session.user.id);
  if (!student) redirect("/dashboard/students");

  revalidatePath("/dashboard/students");
  revalidatePath(`/dashboard/students/${id}`);
  redirect(`/dashboard/students/${id}`);
}
