/**
 * Contract for "run a server action, then open the returned URL in a new tab".
 *
 * A server action that ends in an external destination (a video room today, a
 * payment page or a signed download tomorrow) must not `redirect()`: a redirect
 * navigates the current tab and cannot be combined with `target="_blank"` when
 * React runs the action itself. Instead the action returns this state and
 * `components/shared/external-action-form.tsx` opens the URL in a new tab.
 *
 * Client-safe on purpose (no `server-only`): the action and the client
 * component both import the type.
 */

export type ExternalRedirectState = {
  /** Present only after every authorization check passed. */
  url?: string;
  /** Human-readable failure; the form closes any pre-opened tab and shows this. */
  error?: string;
};

/**
 * Only absolute HTTPS destinations are allowed through.
 *
 * The room URL is already validated at boot (`lib/env.ts`), but this is the
 * last gate before a URL reaches the browser: it rejects `javascript:`,
 * `data:`, relative paths and malformed values even if a future config source
 * skips the env schema.
 */
export function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The only shape an action should use to hand a URL to the client.
 *
 * A missing or unsafe URL becomes an error instead of a dead button.
 */
export function externalRedirect(
  url: string | null | undefined,
  fallbackError: string,
): ExternalRedirectState {
  return isHttpsUrl(url) ? { url } : { error: fallbackError };
}
