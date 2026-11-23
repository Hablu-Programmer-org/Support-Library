"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { CloseIcon, ImageIcon } from "@/components/icons";

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
/** What happened to files handed to a field. */
export type AttachOutcome = {
  /** Files that joined the selection. */
  added: number;
  /** The field's own note about skipped files (type, limit, duplicate), if any. */
  note: string | null;
};

type DropTarget = {
  container: () => HTMLElement | null;
  add: (files: readonly File[]) => AttachOutcome;
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

/**
 * The field closest to `source` in its form: the smallest ancestor that holds
 * a field wins, and the first field in document order within it. A form with
 * an issue field and an answer field sends each editor's files to its own.
 */
function nearestDropTarget(source: Element | null): DropTarget | null {
  const form = source?.closest("form");
  if (!source || !form) return null;
  const targets = Array.from(dropTargets);
  for (let node = source.parentElement; node; node = node.parentElement) {
    const inside = targets.filter((candidate) => {
      const container = candidate.container();
      return Boolean(container && node.contains(container));
    });
    if (inside.length) {
      return inside.reduce((first, candidate) =>
        first.container()!.compareDocumentPosition(candidate.container()!) & Node.DOCUMENT_POSITION_PRECEDING
          ? candidate
          : first,
      );
    }
    if (node === form) break;
  }
  return null;
}

/**
 * Hand files to the attachment field that belongs with `source` — the nearest
 * one in the same form, else the first one on screen — the way a drop on the page
 * would. Used by the issue editor for pasted and dropped screenshots, which
 * must never become inline images (attachments stay private until publish).
 * Returns null when no field is mounted.
 */
export function attachFilesNear(
  source: Element | null,
  files: readonly File[],
): (AttachOutcome & { container: HTMLElement | null }) | null {
  // A drop the editor consumed never reaches the window listener.
  stopTracking();
  const target =
    nearestDropTarget(source) ||
    Array.from(dropTargets).find((candidate) => (candidate.container()?.getClientRects().length ?? 0) > 0) ||
    null;
  if (!target) return null;
  return { ...target.add(files), container: target.container() };
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
  onCountChange,
  labelClassName = nativeLabelClass,
}: {
  name?: string;
  label?: string;
  /** Attachment budget for the whole item, including images already saved. */
  maxFiles?: number;
  /** Images already saved on the item, e.g. when editing an issue. */
  existingCount?: number;
  description?: string;
  accept?: string;
  /** Number of selected (not yet uploaded) images, after every change. */
  onCountChange?: (count: number) => void;
  /** To match the other labels of the form it sits in. */
  labelClassName?: string;
}) {
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const urlsRef = useRef(new Map<string, string>());
  const filesRef = useRef<File[]>([]);
  const onCountChangeRef = useRef(onCountChange);
  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);
  const inputId = useId();
  const descriptionId = `${inputId}-description`;

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
    onCountChangeRef.current?.(next.length);
  }, []);

  const addFiles = useCallback(
    (incoming: readonly File[]): AttachOutcome => {
      if (!incoming.length) return { added: 0, note: null };
      if (budget === 0) {
        const full = `This item already has ${maxFiles} images. Remove one to add another.`;
        setNote(full);
        return { added: 0, note: full };
      }

      const before = filesRef.current.length;
      const result = mergeFileSelection({
        existing: filesRef.current,
        incoming,
        maxFiles: budget,
      });

      replaceFiles(result.files);
      const note = describeMerge(result, budget);
      setNote(note);
      return { added: result.files.length - before, note };
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

  const openPicker = () => {
    if (!full) inputRef.current?.click();
  };

  return (
    <div ref={containerRef} data-attachment-drop="" className="space-y-3">
      <label htmlFor={inputId} className={labelClassName}>
        {label}
      </label>
      {/* The real input stays in the form (name, multiple, accept) but is visually
          hidden; the zone below is its large, keyboard-reachable face. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        name={name}
        multiple
        accept={accept}
        disabled={full}
        onChange={handlePick}
        aria-describedby={description ? descriptionId : undefined}
        className="sr-only"
        tabIndex={-1}
      />
      <div
        role="button"
        tabIndex={full ? -1 : 0}
        aria-disabled={full || undefined}
        aria-label={full ? "Attachment limit reached" : `Add ${label.toLowerCase()}`}
        aria-describedby={description ? descriptionId : undefined}
        onClick={openPicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openPicker();
          }
        }}
        className={`flex min-h-28 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-6 text-center transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 motion-reduce:transition-none ${
          full
            ? "cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900/40"
            : dragActive
              ? "cursor-copy border-cyan-500 bg-cyan-50 dark:border-cyan-400 dark:bg-cyan-500/10"
              : "cursor-pointer border-slate-300 bg-slate-50/60 hover:border-cyan-400 hover:bg-cyan-50/50 dark:border-slate-700 dark:bg-slate-950/30 dark:hover:border-cyan-500/60 dark:hover:bg-cyan-500/5"
        }`}
      >
        <span
          aria-hidden="true"
          className="flex size-10 items-center justify-center rounded-full bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300"
        >
          <ImageIcon size={20} />
        </span>
        <span className="text-sm text-slate-700 dark:text-slate-200">
          {full ? (
            "Attachment limit reached"
          ) : dragActive ? (
            <span className="font-semibold text-cyan-700 dark:text-cyan-300">Drop images to attach</span>
          ) : (
            <>
              Drop screenshots here or{" "}
              <span className="font-semibold text-cyan-700 underline-offset-2 hover:underline dark:text-cyan-300">
                browse
              </span>
            </>
          )}
        </span>
        {description && (
          <span id={descriptionId} className="max-w-md text-xs text-slate-500 dark:text-slate-400">
            {full ? `This item already has ${maxFiles} images. Remove one to add another.` : description}
          </span>
        )}
      </div>

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
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Selected attachments — {previews.length} of {budget}
            {existingCount > 0 && ` · ${existingCount} already attached`}
          </p>
          <ul className="flex flex-wrap gap-3">
            {previews.map(({ file, url }) => {
              const key = fileKey(file);
              return (
                <li key={key} className="w-24">
                  <div className="relative size-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-950">
                    {/* Local blob previews never leave the browser. */}
                    {url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt={`Preview of ${file.name}`}
                        className="size-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => removeFile(file)}
                      aria-label={`Remove ${file.name}`}
                      title={`Remove ${file.name}`}
                      // 44px hit area around a small visible chip.
                      className="group/remove absolute -right-1 -top-1 flex size-11 items-start justify-end p-1.5 focus-visible:outline-none"
                    >
                      <span className="flex size-6 items-center justify-center rounded-full bg-slate-950/75 text-white shadow transition group-hover/remove:bg-danger-600 group-focus-visible/remove:ring-2 group-focus-visible/remove:ring-cyan-400 motion-reduce:transition-none">
                        <CloseIcon size={13} />
                      </span>
                    </button>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-slate-600 dark:text-slate-300" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-slate-500">{formatByteSize(file.size)}</p>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
