import "server-only";

import mongoose from "mongoose";

import { buildUploadObjectKey, sanitizeOriginalName } from "./keys";
import { formatBytes, uploadLimit, uploadMaxBytes } from "./limits";
import { detectImage, isOversizedImage } from "./sniff";
import { getUploadStore } from "./store";

/**
 * One accepted upload, ready to be embedded in an issue or reply document.
 *
 * `_id` is generated here rather than by Mongo so the download route, the audit
 * trail and the compensation logic all agree on the identifier before the parent
 * document (and its transaction) exists.
 */
export type IngestedUpload = {
  _id: string;
  key: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  uploadedBy: string;
  createdAt: Date;
};

/** Name of the multipart field holding uploaded files. */
export const UPLOAD_FIELD = "uploads";

/** Raised for a rejected file; `field` lets the action map it to a form error. */
export class UploadValidationError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.name = "UploadValidationError";
    this.field = field;
  }
}

/**
 * Reads file inputs out of a submitted `FormData`.
 *
 * A `<input type="file">` that was left untouched still submits one entry, with
 * an empty name and size 0, so those are dropped here rather than surfacing as a
 * confusing "file is empty" validation error.
 */
export function formFiles(formData: FormData, key: string = UPLOAD_FIELD): File[] {
  const entries = formData.getAll(key);
  return entries.filter(
    (entry): entry is File =>
      typeof entry !== "string" && entry.size > 0 && typeof entry.arrayBuffer === "function",
  );
}

/**
 * Validates and stores every selected file.
 *
 * The declared MIME type and the client filename are ignored for every decision
 * that matters: the type is derived from the magic bytes, the size is re-measured
 * after reading, and the storage key is server-generated. If any file in the set
 * is rejected, everything already written for this request is deleted, so a
 * failed submission never leaves orphaned objects behind.
 */
export async function ingestUploads(
  files: File[],
  actorId: string,
  field: string = UPLOAD_FIELD,
): Promise<IngestedUpload[]> {
  if (!files.length) return [];

  const limit = uploadLimit();
  if (files.length > limit) {
    throw new UploadValidationError(
      field,
      `Add at most ${limit} file${limit === 1 ? "" : "s"}`,
    );
  }

  const store = getUploadStore();
  if (!store) {
    throw new UploadValidationError(
      field,
      "File uploads are not enabled on this server. Attach a link instead.",
    );
  }

  const maxBytes = uploadMaxBytes();
  const accepted: IngestedUpload[] = [];

  try {
    for (const file of files) {
      const originalName = sanitizeOriginalName(file.name);

      if (!file.size) {
        throw new UploadValidationError(field, `${originalName} is empty`);
      }
      if (file.size > maxBytes) {
        throw new UploadValidationError(
          field,
          `${originalName} is larger than ${formatBytes(maxBytes)}`,
        );
      }

      const buffer = Buffer.from(await file.arrayBuffer());
      // Defence in depth: the declared size is not authoritative.
      if (buffer.byteLength > maxBytes) {
        throw new UploadValidationError(
          field,
          `${originalName} is larger than ${formatBytes(maxBytes)}`,
        );
      }

      const image = detectImage(buffer);
      if (!image) {
        throw new UploadValidationError(
          field,
          `${originalName} is not a supported image (PNG, JPEG, GIF or WebP)`,
        );
      }
      if (isOversizedImage(image)) {
        throw new UploadValidationError(
          field,
          `${originalName} has unusable image dimensions`,
        );
      }

      const key = buildUploadObjectKey(image.extension);
      await store.put(key, buffer, image.mimeType);

      accepted.push({
        _id: new mongoose.Types.ObjectId().toHexString(),
        key,
        originalName,
        mimeType: image.mimeType,
        byteSize: buffer.byteLength,
        width: image.width,
        height: image.height,
        uploadedBy: actorId,
        createdAt: new Date(),
      });
    }

    return accepted;
  } catch (error) {
    await discardUploads(accepted);
    throw error;
  }
}

/**
 * Best-effort removal of stored objects.
 *
 * Used on every failure path after `ingestUploads` succeeds: a replayed
 * operation id, a lost optimistic-locking race, a missing issue, or a crash
 * between the object write and the document write. It never throws, because it
 * runs while another error is already being reported.
 */
export async function discardUploads(uploads: readonly IngestedUpload[]): Promise<void> {
  if (!uploads.length) return;
  const store = getUploadStore();
  if (!store) return;
  await Promise.allSettled(uploads.map((upload) => store.delete(upload.key)));
}
