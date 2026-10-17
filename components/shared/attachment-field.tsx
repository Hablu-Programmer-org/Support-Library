import { nativeLabelClass } from "@/lib/config/fields";

/** Multipart field name carrying uploaded images. Must match `UPLOAD_FIELD`. */
export const UPLOAD_FILES_NAME = "uploads";

/** `accept` value for the image types the server verifies by magic bytes. */
export const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";

/**
 * File picker for image attachments.
 *
 * `accept` is a convenience only — it filters the OS picker and is trivially
 * bypassed, so the server re-checks the real type from the file's magic bytes and
 * rejects anything else. The exact count and size limits are enforced server-side
 * too; a rejected file is reported back by field name.
 */
export function AttachmentField({
  name = UPLOAD_FILES_NAME,
  label = "Screenshots",
  description = "PNG, JPEG, GIF or WebP. Add up to 3 images, 5 MB each.",
  accept = ACCEPTED_IMAGE_TYPES,
}: {
  name?: string;
  label?: string;
  description?: string;
  accept?: string;
}) {
  return (
    <label className={nativeLabelClass}>
      <span>{label}</span>
      <input
        type="file"
        name={name}
        multiple
        accept={accept}
        className="w-full cursor-pointer rounded-xl border border-transparent bg-slate-100 px-3 py-2 text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-cyan-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:file:bg-cyan-500 dark:hover:border-slate-700"
      />
      {description && (
        <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
          {description}
        </span>
      )}
    </label>
  );
}
