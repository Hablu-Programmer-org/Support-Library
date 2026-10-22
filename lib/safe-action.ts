import { validateCsrfToken } from "@/lib/csrf";

export async function withCsrfProtection<T>(
  formData: FormData,
  action: (data: FormData) => Promise<T>
): Promise<T> {
  const csrfToken = formData.get("csrfToken");
  if (typeof csrfToken !== "string" || !csrfToken) {
    throw new Error("CSRF token missing");
  }
  const valid = await validateCsrfToken(csrfToken);
  if (!valid) {
    throw new Error("Invalid CSRF token");
  }
  return action(formData);
}

/**
 * Non-throwing CSRF check for actions that report failures in the form.
 *
 * `withCsrfProtection` throws, which turns a stale page (an expired session, a
 * token minted before an `AUTH_SECRET` change) into the whole-page error
 * boundary and loses whatever the user had typed. A composer that renders its
 * own error message asks this instead and returns a state the user can act on.
 */
export async function csrfTokenIsValid(formData: FormData): Promise<boolean> {
  const csrfToken = formData.get("csrfToken");
  if (typeof csrfToken !== "string" || !csrfToken) return false;
  return validateCsrfToken(csrfToken);
}
