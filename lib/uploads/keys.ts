import { randomUUID } from "node:crypto";

/**
 * Builds the storage object key for one upload.
 *
 * The key is entirely server-generated: the client filename never reaches the
 * bucket path, so a hostile name (`../../etc/passwd`, a 4 KB unicode string, a
 * name that collides with another object) can only ever be a display label. The
 * date prefix keeps the bucket navigable and gives lifecycle rules something to
 * match on; the random UUID makes the key unguessable and collision-free.
 */
export function buildUploadObjectKey(extension: string, now: Date = new Date()): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const safeExtension = /^[a-z0-9]{1,8}$/.test(extension) ? extension : "bin";
  return `attachments/${year}/${month}/${randomUUID()}.${safeExtension}`;
}

/** Maximum length of the display filename persisted with an upload. */
export const ORIGINAL_NAME_MAX_LENGTH = 200;

/**
 * Collapses a client filename down to something safe to display.
 *
 * Only ever a label — it is never used as a path — but it is still clamped: the
 * value is rendered back to staff, so control characters and an unbounded length
 * must not survive.
 */
export function sanitizeOriginalName(name: string, fallback = "image"): string {
  const base = (name ?? "")
    // Strip any directory component a browser might send.
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    // Leading dots would render as hidden/odd filenames.
    .replace(/^\.+/, "")
    .trim();

  if (!base) return fallback;
  return base.slice(0, ORIGINAL_NAME_MAX_LENGTH);
}
