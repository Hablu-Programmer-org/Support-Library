/**
 * Cross-app links to the Hablu Programmer LMS (the main frontend).
 *
 * The two apps are separate deployments with separate sessions — there is no
 * shared cookie, so navigation is a plain cross-origin jump and the LMS applies
 * its own auth there. Nothing here is a secret: `NEXT_PUBLIC_*` values are
 * compiled into the client bundle.
 *
 * The origin is normalized (trailing slash dropped) so every caller can build a
 * path with plain string concatenation.
 */

const normalizeOrigin = (value: string | undefined) => {
  const raw = (value ?? "").trim();
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin + (url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, ""));
  } catch {
    return null;
  }
};

/** Origin of the LMS, or null when it is unset/unusable. */
export const lmsOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_LMS_URL);

/** True when the "My Courses" link can be rendered at all. */
export const hasLmsLink = Boolean(lmsOrigin);

/** Build an absolute LMS URL. Returns null when no LMS origin is configured. */
export function lmsHref(path: string): string | null {
  if (!lmsOrigin) return null;
  return `${lmsOrigin}${path.startsWith("/") ? path : `/${path}`}`;
}
