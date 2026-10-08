"use server";

import { assertRole } from "@/lib/auth-guard";
import { lookupLmsStudent } from "@/lib/lms";

/**
 * Email autocomplete for the case form: resolves a student's name from the main
 * hp-v2 database when an email is typed. Read-only and staff-only (VIEWER can
 * never open the case form, so the guard matches its other actions).
 */
export async function lookupLmsStudentAction(email: string) {
  const guard = await assertRole("ADMIN", "MENTOR");
  if (!guard.ok) return null;

  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  return lookupLmsStudent(normalized);
}