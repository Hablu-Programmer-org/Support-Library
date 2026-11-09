/**
 * Client-side file-selection rules for the attachment fields.
 *
 * The server stays authoritative (magic-byte sniffing, byte caps and the
 * per-item count in `lib/uploads/limits.ts`), but the picker has to give the
 * same answer straight away: a file that will certainly be rejected should not
 * be previewed as if it had been accepted, and a second selection must *add*
 * to the first instead of replacing it.
 */

/** Image types the server accepts (see `UPLOAD_IMAGE_MIME_TYPES`). */
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;

/** `accept` value for the file picker. */
export const ACCEPTED_IMAGE_ACCEPT = ACCEPTED_IMAGE_TYPES.join(",");

/**
 * Files one field may hold before submitting.
 *
 * Duplicated from `UPLOAD_LIMIT_DEFAULT` because the component also runs in the
 * browser, where server-only modules must not be imported. Keep them in sync.
 */
export const DEFAULT_MAX_FILES = 5;

/** The subset of `File` the merge logic needs, so it can be unit-tested. */
export type SelectableFile = {
  name: string;
  size: number;
  lastModified: number;
  type: string;
};

/**
 * Identity of a picked file. Browsers give no stable id, and two screenshots
 * often share a name, so size and modification time disambiguate them.
 */
export function fileKey(file: SelectableFile): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * Declared MIME types are a convenience only. An empty type is kept — some file
 * managers report none, and the server derives the real format from the bytes —
 * while a clearly unsupported type is dropped so the user sees it immediately.
 */
export function isAcceptedImageType(file: SelectableFile): boolean {
  const type = file.type.trim().toLowerCase();
  return !type || (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type);
}

export type MergeResult<T extends SelectableFile> = {
  /** Existing files plus every accepted new file, capped at `maxFiles`. */
  files: T[];
  /** Files skipped because the same image was already selected. */
  duplicates: number;
  /** Files skipped because they are not PNG/JPEG/GIF/WebP. */
  rejectedType: number;
  /** Files skipped because the field is already full. */
  overflow: number;
};

/**
 * Merge a new selection into the current one.
 *
 * Order matters: duplicates and unsupported types are reported even when the
 * field is full, so the message explains the real reason a file was skipped.
 */
export function mergeFileSelection<T extends SelectableFile>({
  existing,
  incoming,
  maxFiles = DEFAULT_MAX_FILES,
  accept = isAcceptedImageType,
}: {
  existing: readonly T[];
  incoming: readonly T[];
  maxFiles?: number;
  accept?: (file: T) => boolean;
}): MergeResult<T> {
  const seen = new Set(existing.map(fileKey));
  const files = [...existing];
  let duplicates = 0;
  let rejectedType = 0;
  let overflow = 0;

  for (const file of incoming) {
    const key = fileKey(file);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    if (!accept(file)) {
      rejectedType += 1;
      continue;
    }
    if (files.length >= maxFiles) {
      overflow += 1;
      continue;
    }
    seen.add(key);
    files.push(file);
  }

  return { files, duplicates, rejectedType, overflow };
}

/**
 * Human-readable summary of a merge, or `null` when every file was accepted.
 * Mirrors the wording the server uses for the same rejections.
 */
export function describeMerge(result: MergeResult<SelectableFile>, maxFiles: number): string | null {
  const messages: string[] = [];
  const plural = (count: number) => (count === 1 ? "file" : "files");

  if (result.rejectedType) {
    messages.push(
      `${result.rejectedType} ${plural(result.rejectedType)} skipped: only PNG, JPEG, GIF or WebP images can be attached.`,
    );
  }
  if (result.overflow) {
    messages.push(
      `Only ${maxFiles} ${maxFiles === 1 ? "image" : "images"} can be attached; ${result.overflow} ${plural(result.overflow)} ${result.overflow === 1 ? "was" : "were"} not added.`,
    );
  }
  if (result.duplicates) {
    messages.push(
      `${result.duplicates} ${plural(result.duplicates)} skipped: already selected.`,
    );
  }

  return messages.length ? messages.join(" ") : null;
}
