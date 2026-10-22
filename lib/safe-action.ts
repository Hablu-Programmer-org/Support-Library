import { redirect } from "next/navigation";

import { checkCsrfToken, validateCsrfToken } from "@/lib/csrf";

/**
 * CSRF guard for form actions.
 *
 * A page that was rendered before the session ended is the common real case, so
 * a missing/expired token sends the user to sign in again rather than throwing
 * into the error boundary — the form is stale anyway and re-signing in is the
 * only way forward. A bad signature *with* a live session is treated as
 * tampering and still fails hard.
 *
 * Actions that must keep what the user typed (the reply composer) check
 * `csrfTokenIsValid` themselves and render the reason inline instead.
 */
export async function withCsrfProtection<T>(
  formData: FormData,
  action: (data: FormData) => Promise<T>
): Promise<T> {
  const csrfToken = formData.get("csrfToken");
  const check = await checkCsrfToken(typeof csrfToken === "string" ? csrfToken : "");

  if (check === "no-session") {
    redirect("/login");
  }
  if (check !== "ok") {
    throw new Error("Invalid CSRF token");
  }
  return action(formData);
}

/**
 * Non-throwing CSRF check for actions that report failures in the form.
 *
 * `withCsrfProtection` redirects or throws, which loses whatever the user had
 * typed. A composer that renders its own error message asks this instead and
 * returns a state the user can act on.
 */
export async function csrfTokenIsValid(formData: FormData): Promise<boolean> {
  const csrfToken = formData.get("csrfToken");
  if (typeof csrfToken !== "string" || !csrfToken) return false;
  return validateCsrfToken(csrfToken);
}
