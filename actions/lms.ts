"use server";

import { assertRole } from "@/lib/auth-guard";
import { lookupLmsStudent } from "@/lib/lms";
import { consumeRateLimit } from "@/lib/services/rate-limit";
import { withCsrfProtection } from "@/lib/safe-action";

/**
 * Email autocomplete for the issue form: resolves a student's name from the main
 * hp-v2 database when an email is typed. Read-only and staff-only (a STUDENT can
 * never open the issue form, so the guard matches its other actions).
 */
export async function lookupLmsStudentAction(email: string, csrfToken: string) {
  return withCsrfProtection(
    (() => {
      const fd = new FormData();
      fd.append("csrfToken", csrfToken);
      return fd;
    })(),
    async () => {
      const guard = await assertRole("ADMIN", "MENTOR");
      if (!guard.ok) return null;

      const normalized = email.trim().toLowerCase();
      if (!normalized) return null;

      try {
        await consumeRateLimit("lms.lookup", guard.session.user.id);
        return await lookupLmsStudent(normalized);
      } catch {
        return null;
      }
    }
  );
}