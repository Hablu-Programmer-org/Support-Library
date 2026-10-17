/**
 * Upload caps.
 *
 * Mirrors the attachment-link design in `lib/validation/common.ts`: the value is
 * read per call (so it is always current), a bad or missing value falls back to
 * the strict default instead of disabling the guard, and a hard ceiling is
 * enforced no matter what the environment says.
 *
 * NOTE: `next.config.mjs` cannot import this module (it is TypeScript), so the
 * Server Action body limit it derives duplicates these constants. Keep the two in
 * sync when changing the defaults or ceilings.
 */

/** Default cap on uploaded files per issue or reply when `MAX_UPLOADS_PER_ITEM` is unset. */
export const UPLOAD_LIMIT_DEFAULT = 3;

/** Hard ceiling for `MAX_UPLOADS_PER_ITEM`, independent of the environment. */
export const UPLOAD_LIMIT_MAX = 10;

/** Default per-file byte cap when `MAX_UPLOAD_BYTES` is unset (5 MiB). */
export const UPLOAD_MAX_BYTES_DEFAULT = 5 * 1024 * 1024;

/** Hard ceiling for `MAX_UPLOAD_BYTES`, independent of the environment (25 MiB). */
export const UPLOAD_MAX_BYTES_CEILING = 25 * 1024 * 1024;

/** Smallest per-file cap an operator may configure (1 KiB). */
export const UPLOAD_MAX_BYTES_FLOOR = 1024;

/**
 * MIME types accepted in phase 1.
 *
 * Images only: R2 (and the app) performs no malware scanning, so the risky
 * container formats (PDF, ZIP, Office) are deliberately excluded until an
 * antivirus step exists.
 */
export const UPLOAD_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
] as const;

export type UploadImageMimeType = (typeof UPLOAD_IMAGE_MIME_TYPES)[number];

function readBoundedInt(raw: string | undefined, fallback: number, min: number, max: number) {
  const value = (raw ?? "").trim();
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

/** Configured maximum number of uploaded files per item (env: `MAX_UPLOADS_PER_ITEM`). */
export function uploadLimit(): number {
  return readBoundedInt(process.env.MAX_UPLOADS_PER_ITEM, UPLOAD_LIMIT_DEFAULT, 1, UPLOAD_LIMIT_MAX);
}

/** Configured maximum size of one uploaded file in bytes (env: `MAX_UPLOAD_BYTES`). */
export function uploadMaxBytes(): number {
  return readBoundedInt(
    process.env.MAX_UPLOAD_BYTES,
    UPLOAD_MAX_BYTES_DEFAULT,
    UPLOAD_MAX_BYTES_FLOOR,
    UPLOAD_MAX_BYTES_CEILING,
  );
}

/** Human-readable byte size, used in validation messages. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const megabytes = bytes / (1024 * 1024);
    return `${Number.isInteger(megabytes) ? megabytes : megabytes.toFixed(1)} MB`;
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
