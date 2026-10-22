"use client";

import { useEffect, useState } from "react";

import { CloseIcon, SearchIcon } from "@/components/icons";

type Attachment = {
  id: string;
  originalName: string;
  mimeType: string;
  byteSize: number;
  width?: number | null;
  height?: number | null;
};

export const formatByteSize = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes >= 1024 * 1024) {
    const megabytes = bytes / (1024 * 1024);
    return `${megabytes >= 10 ? Math.round(megabytes) : megabytes.toFixed(1)} MB`;
  }
  if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${bytes} B`;
};

/**
 * Renders uploaded images, opened in a preview dialog instead of a new tab.
 *
 * A plain `<img>` on purpose: `next/image` optimizes through a server-side fetch
 * that carries no session cookie, so an authenticated same-origin route like
 * `/api/attachments/<id>` would be answered with 401 and render as a broken
 * image. The uploader and staff are the only identities the route accepts.
 *
 * Opening in a dialog keeps the reviewer on the case (they can compare the image
 * with the problem text) instead of leaving to a bare tab; the dialog still
 * offers an "Open original" link for a full-size view or a download.
 */
export function AttachmentList({ uploads }: { uploads: Attachment[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const open = uploads.find((upload) => upload.id === openId) ?? null;

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (!uploads.length) return null;

  return (
    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Attachments
        </h4>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">
          Click to preview
        </span>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {uploads.map((upload) => {
          const src = `/api/attachments/${upload.id}`;
          return (
            <li key={upload.id} className="space-y-1">
              <button
                type="button"
                onClick={() => setOpenId(upload.id)}
                aria-label={`Preview ${upload.originalName}`}
                title="Open preview"
                className="group relative block w-full cursor-zoom-in overflow-hidden rounded-md border border-slate-200 bg-slate-50 transition hover:border-primary/60 hover:shadow-sm focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-primary dark:border-slate-700 dark:bg-slate-950"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={upload.originalName}
                  loading="lazy"
                  decoding="async"
                  className="mx-auto h-40 w-full object-contain"
                />
                {/* Always-visible affordance: hover does not exist on touch. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-md bg-slate-950/60 text-white shadow-sm"
                >
                  <SearchIcon size={13} />
                </span>
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/45 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                >
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-950/85 px-3 py-1 text-xs font-semibold text-white">
                    <SearchIcon size={13} />
                    Preview
                  </span>
                </span>
              </button>
              <div className="flex items-center justify-between gap-2 text-xs">
                <span
                  className="truncate text-slate-600 dark:text-slate-300"
                  title={upload.originalName}
                >
                  {upload.originalName}
                </span>
                <span className="shrink-0 text-slate-400 dark:text-slate-500">
                  {formatByteSize(upload.byteSize)}
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      {open && (
        <div
          aria-label={open.originalName}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
        >
          <button
            type="button"
            aria-label="Close preview"
            onClick={() => setOpenId(null)}
            className="attachment-backdrop-in absolute inset-0 h-full w-full cursor-default bg-slate-950/80 backdrop-blur-sm"
          />
          <div className="attachment-preview-in relative z-10 w-full max-w-4xl space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-medium text-slate-100">
                {open.originalName}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  className="rounded px-2 py-1 text-xs font-semibold text-primary-300 hover:underline"
                  href={`/api/attachments/${open.id}`}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  Open original
                </a>
                <button
                  autoFocus
                  type="button"
                  onClick={() => setOpenId(null)}
                  aria-label="Close preview"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 transition hover:bg-slate-800"
                >
                  <CloseIcon size={18} />
                </button>
              </div>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/attachments/${open.id}`}
              alt={open.originalName}
              className="mx-auto max-h-[75vh] w-auto max-w-full object-contain"
            />
            <p className="text-center text-xs text-slate-400">
              {formatByteSize(open.byteSize)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
