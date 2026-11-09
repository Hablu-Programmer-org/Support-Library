"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { formatByteSize } from "@/components/shared/attachment-list";
import { nativeLabelClass } from "@/lib/config/fields";
import {
  ACCEPTED_IMAGE_ACCEPT,
  DEFAULT_MAX_FILES,
  describeMerge,
  fileKey,
  mergeFileSelection,
} from "@/lib/uploads/selection";

/** Multipart field name carrying uploaded images. Must match `UPLOAD_FIELD`. */
export const UPLOAD_FILES_NAME = "uploads";

/** `accept` value for the image types the server verifies by magic bytes. */
export const ACCEPTED_IMAGE_TYPES = ACCEPTED_IMAGE_ACCEPT;

/* -------------------------------------------------------------------------- */
/* Page-wide drag & drop                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Files can be dropped anywhere on the page, not just on a dashed box: most
 * file managers (and mobile pickers) only allow one file at a time, so dragging
 * an existing selection onto the page is the quickest way to attach several.
 *
 * Every mounted `AttachmentField` registers itself here. A drop is routed to the
 * field under the pointer, and to the first visible field when the pointer is
 * somewhere else (a heading, the page margin), so the gesture never does
 * nothing.
 */
type DropTarget = {
  container: () => HTMLElement | null;
  add: (files: readonly File[]) => void;
};

const dropTargets = new Set<DropTarget>();
const dragSubscribers = new Set<() => void>();
let dragTarget: DropTarget | null = null;
let dragTracking = false;
let listenersInstalled = false;

function hasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return Boolean(types && Array.from(types).includes("Files"));
}

function notifyDrag() {
  dragSubscribers.forEach((subscriber) => subscriber());
}

function resolveDropTarget(x: number, y: number): DropTarget | null {
  const element =
    typeof document.elementFromPoint === "function" ? document.elementFromPoint(x, y) : null;

  if (element) {
    for (const target of dropTargets) {
      const container = target.container();
      if (container && container.contains(element)) return target;
    }
  }

  // Nothing under the pointer (header, margin, a modal backdrop): use the first
  // field that is still on screen.
  for (const target of dropTargets) {
    const container = target.container();
    if (container && container.getClientRects().length > 0) return target;
  }
  return null;
}

function stopTracking() {
  if (!dragTracking && dragTarget === null) return;
  dragTracking = false;
  dragTarget = null;
  notifyDrag();
}

function handleDragEnter(event: DragEvent) {
  if (!hasFiles(event)) return;
  event.preventDefault();
}

function handleDragOver(event: DragEvent) {
  // Text and link drags keep their normal browser behaviour.
  if (!hasFiles(event)) return;
  // Without this the browser navigates to the dropped file instead of firing `drop`.
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";

  const next = resolveDropTarget(event.clientX, event.clientY);
  if (next !== dragTarget || !dragTracking) {
    dragTarget = next;
    dragTracking = true;
    notifyDrag();
  }
}

function handleDragLeave(event: DragEvent) {
  // Chrome reports `relatedTarget === null` only when the pointer leaves the window.
  if (event.relatedTarget === null) stopTracking();
}

function handleDrop(event: DragEvent) {
  if (!hasFiles(event)) return;
  event.preventDefault();
  const target = resolveDropTarget(event.clientX, event.clientY);
  const dropped = event.dataTransfer ? Array.from(event.dataTransfer.files) : [];
  stopTracking();
  if (target && dropped.length) target.add(dropped);
}

function installDropListeners() {
  if (listenersInstalled || typeof window === "undefined") return;
  listenersInstalled = true;
  window.addEventListener("dragenter", handleDragEnter);
  window.addEventListener("dragover", handleDragOver);
  window.addEventListener("dragleave", handleDragLeave);
  window.addEventListener("drop", handleDrop);
  window.addEventListener("dragend", stopTracking);
}

function removeDropListeners() {
  if (!listenersInstalled) return;
  listenersInstalled = false;
  window.removeEventListener("dragenter", handleDragEnter);
  window.removeEventListener("dragover", handleDragOver);
  window.removeEventListener("dragleave", handleDragLeave);
  window.removeEventListener("drop", handleDrop);
  window.removeEventListener("dragend", stopTracking);
  stopTracking();
}

/* -------------------------------------------------------------------------- */
/* Field                                                                      */
/* -------------------------------------------------------------------------- */

function setInputFiles(input: HTMLInputElement, files: File[]) {
  // `input.files` is read-only; a DataTransfer is the only way to build a new
  // FileList, and it also carries the earlier selection that was merged in.
  try {
    const transfer = new DataTransfer();
    files.forEach((file) => transfer.items.add(file));
    input.files = transfer.files;
  } catch {
    // Older browsers cannot rebuild a FileList. The preview still works, but the
    // field may submit nothing — the server never trusts the client anyway.
  }
}

/**
 * File picker for image attachments.
 *
 * `accept` is a convenience only — it filters the OS picker and is trivially
 * bypassed, so the server re-checks the real type from the file's magic bytes and
 * rejects anything else. The exact count and size limits are enforced server-side
 * too; a rejected file is reported back by field name.
 *
 * Picking files twice adds to the selection instead of replacing it, and images
 * can be dropped anywhere on the page while the field is mounted.
 */
export function AttachmentField({
  name = UPLOAD_FILES_NAME,
  label = "Attachments",
  maxFiles = DEFAULT_MAX_FILES,
  existingCount = 0,
  description = `Images only: PNG, JPEG, GIF or WebP. Add up to ${maxFiles} images, 5 MB each.`,
  accept = ACCEPTED_IMAGE_ACCEPT,
}: {
  name?: string;
  label?: string;
  /** Attachment budget for the whole item, including images already saved. */
  maxFiles?: number;
  /** Images already saved on the item, e.g. when editing an issue. */
  existingCount?: number;
  description?: string;
  accept?: string;
}) {
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const urlsRef = useRef(new Map<string, string>());
  const filesRef = useRef<File[]>([]);

  // Saved attachments count against the same per-item cap the server applies.
  const budget = Math.max(0, maxFiles - Math.max(0, existingCount));
  const full = budget === 0;

  /**
   * Replace the current selection and keep the local previews in step.
   *
   * Previews are object URLs that must be revoked when a file leaves the
   * selection; otherwise a long editing session leaks one blob per removal.
   */
  const replaceFiles = useCallback((next: File[]) => {
    const input = inputRef.current;
    if (input) setInputFiles(input, next);

    const urls = urlsRef.current;
    const keep = new Set(next.map(fileKey));
    urls.forEach((url, key) => {
      if (!keep.has(key)) {
        URL.revokeObjectURL(url);
        urls.delete(key);
      }
    });
    next.forEach((file) => {
      const key = fileKey(file);
      if (!urls.has(key)) urls.set(key, URL.createObjectURL(file));
    });

    const nextPreviews = next.map((file) => {
      const key = fileKey(file);
      return { file, url: urls.get(key) ?? "" };
    });

    filesRef.current = next;
    setPreviews(nextPreviews);
  }, []);

  const addFiles = useCallback(
    (incoming: readonly File[]) => {
      if (!incoming.length) return;
      if (budget === 0) {
        setNote(`This item already has ${maxFiles} images. Remove one to add another.`);
        return;
      }

      const result = mergeFileSelection({
        existing: filesRef.current,
        incoming,
        maxFiles: budget,
      });

      replaceFiles(result.files);
      setNote(describeMerge(result, budget));
    },
    [budget, maxFiles, replaceFiles],
  );

  const addFilesRef = useRef(addFiles);
  useEffect(() => {
    addFilesRef.current = addFiles;
  }, [addFiles]);

  // Object URLs outlive individual renders, so they are revoked on unmount.
  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
    };
  }, []);

  // Register this field as a page-wide drop target while it is mounted.
  useEffect(() => {
    const target: DropTarget = {
      container: () => containerRef.current,
      add: (incoming) => addFilesRef.current(incoming),
    };

    dropTargets.add(target);
    installDropListeners();

    const update = () => setDragActive(dragTarget === target);
    dragSubscribers.add(update);
    update();

    return () => {
      dropTargets.delete(target);
      dragSubscribers.delete(update);
      if (!dropTargets.size) removeDropListeners();
    };
  }, []);

  const handlePick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.currentTarget.files ?? []);
    // Clearing the value lets the same file be picked again after a removal;
    // `replaceFiles` re-fills the input with the merged selection.
    event.currentTarget.value = "";
    addFiles(picked);
  };

  const removeFile = (file: File) => {
    const key = fileKey(file);
    replaceFiles(filesRef.current.filter((item) => fileKey(item) !== key));
    setNote(null);
  };

  return (
    <div
      ref={containerRef}
      data-attachment-drop=""
      className={`relative space-y-3 rounded-xl border-2 border-dashed p-2 transition ${
        dragActive
          ? "border-cyan-500 bg-cyan-50/70 dark:border-cyan-400 dark:bg-cyan-950/30"
          : "border-transparent"
      }`}
    >
      {dragActive && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/85 px-4 text-center text-sm font-semibold text-cyan-700 dark:bg-slate-950/85 dark:text-cyan-300">
          {full ? "Attachment limit reached" : "Drop images to attach"}
        </div>
      )}

      <label className={nativeLabelClass}>
        <span>{label}</span>
        <input
          ref={inputRef}
          type="file"
          name={name}
          multiple
          accept={accept}
          disabled={full}
          onChange={handlePick}
          className="w-full cursor-pointer rounded-lg border border-transparent bg-slate-100 px-3 py-2 text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-cyan-600 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-800 dark:text-slate-200 dark:file:bg-cyan-500 dark:hover:border-slate-700"
        />
        {description && (
          <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
            {full
              ? `This item already has ${maxFiles} images. Remove one to add another.`
              : description}
          </span>
        )}
      </label>

      {note && (
        <p
          role="status"
          className="border-l-2 border-warning-400 pl-3 text-xs text-slate-600 dark:text-slate-300"
        >
          {note}
        </p>
      )}

      {previews.length > 0 && (
        <div className="space-y-2" aria-live="polite">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Selected attachments
            {` — ${previews.length} of ${budget}`}
            {existingCount > 0 && ` · ${existingCount} already attached`}
          </span>
          <ul className="grid gap-3 sm:grid-cols-2">
            {previews.map(({ file, url }) => {
              const key = fileKey(file);
              return (
                <li key={key} className="space-y-1">
                  {/* Local blob previews never leave the browser. */}
                  {url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={url}
                      alt={`Preview of ${file.name}`}
                      className="h-40 w-full rounded-md border border-slate-200 bg-slate-50 object-contain dark:border-slate-700 dark:bg-slate-950"
                    />
                  )}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span
                      className="truncate text-slate-600 dark:text-slate-300"
                      title={file.name}
                    >
                      {file.name}
                    </span>
                    <span className="shrink-0 text-slate-400 dark:text-slate-500">
                      {formatByteSize(file.size)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeFile(file)}
                      aria-label={`Remove ${file.name}`}
                      className="shrink-0 font-medium text-danger-600 transition hover:underline dark:text-danger-300"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
