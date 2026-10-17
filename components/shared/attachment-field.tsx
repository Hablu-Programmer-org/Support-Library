"use client";

import { useEffect, useRef, useState } from "react";

import { formatByteSize } from "@/components/shared/attachment-list";
import { nativeLabelClass } from "@/lib/config/fields";

/** Multipart field name carrying uploaded images. Must match `UPLOAD_FIELD`. */
export const UPLOAD_FILES_NAME = "uploads";

/** `accept` value for the image types the server verifies by magic bytes. */
export const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp,image/gif";

const ACCEPTED_IMAGE_TYPE_SET = new Set(ACCEPTED_IMAGE_TYPES.split(","));
const MAX_LOCAL_PREVIEWS = 10;

type LocalPreview = {
  file: File;
  name: string;
  byteSize: number;
  url: string;
};

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
  label = "Attachments",
  description = "Images only: PNG, JPEG, GIF or WebP. Add up to 3 images, 5 MB each.",
  accept = ACCEPTED_IMAGE_TYPES,
}: {
  name?: string;
  label?: string;
  description?: string;
  accept?: string;
}) {
  const [previews, setPreviews] = useState<LocalPreview[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const objectUrlsRef = useRef<string[]>([]);

  const revokeObjectUrls = () => {
    objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrlsRef.current = [];
  };

  useEffect(() => {
    const objectUrls = objectUrlsRef;
    return () => {
      objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.current = [];
    };
  }, []);

  const updatePreviews = (files: FileList | null) => {
    revokeObjectUrls();
    const next = Array.from(files ?? [])
      .filter((file) => ACCEPTED_IMAGE_TYPE_SET.has(file.type))
      .slice(0, MAX_LOCAL_PREVIEWS)
      .map((file) => ({
        file,
        name: file.name,
        byteSize: file.size,
        url: URL.createObjectURL(file),
      }));
    objectUrlsRef.current = next.map((preview) => preview.url);
    setPreviews(next);
  };

  const removePreview = (preview: LocalPreview) => {
    const input = inputRef.current;
    if (!input) return;

    const selectedFiles = Array.from(input.files ?? []);
    const targetIndex = selectedFiles.findIndex((file) => file === preview.file);
    if (targetIndex === -1) return;

    const transfer = new DataTransfer();
    selectedFiles.forEach((file, index) => {
      if (index !== targetIndex) transfer.items.add(file);
    });
    input.files = transfer.files;

    URL.revokeObjectURL(preview.url);
    objectUrlsRef.current = objectUrlsRef.current.filter((url) => url !== preview.url);
    setPreviews((current) => current.filter((item) => item.url !== preview.url));
  };

  return (
    <div className="space-y-3">
      <label className={nativeLabelClass}>
        <span>{label}</span>
        <input
          ref={inputRef}
          type="file"
          name={name}
          multiple
          accept={accept}
          onChange={(event) => updatePreviews(event.currentTarget.files)}
          className="w-full cursor-pointer rounded-xl border border-transparent bg-slate-100 px-3 py-2 text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-cyan-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:file:bg-cyan-500 dark:hover:border-slate-700"
        />
        {description && (
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
            {description}
          </span>
        )}
      </label>

      {previews.length > 0 && (
        <div className="space-y-2" aria-live="polite">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Selected attachments
          </span>
          <ul className="grid gap-3 sm:grid-cols-2">
            {previews.map((preview) => (
              <li
                key={preview.url}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"
              >
                {/* Local blob previews never leave the browser. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={preview.url}
                  alt={`Preview of ${preview.name}`}
                  className="mx-auto h-40 w-full bg-slate-50 object-contain dark:bg-slate-950"
                />
                <div className="flex items-center justify-between gap-3 px-3 py-2">
                  <div className="min-w-0">
                    <div
                      className="truncate text-xs text-slate-600 dark:text-slate-300"
                      title={preview.name}
                    >
                      {preview.name}
                    </div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      {formatByteSize(preview.byteSize)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removePreview(preview)}
                    aria-label={`Remove ${preview.name}`}
                    className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-danger-600 transition hover:bg-danger-50 focus:outline-none focus:ring-2 focus:ring-danger-500 dark:text-danger-300 dark:hover:bg-danger-950/40"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
