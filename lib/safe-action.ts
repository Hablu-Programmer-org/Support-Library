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
