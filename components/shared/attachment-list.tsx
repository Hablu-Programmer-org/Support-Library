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
 * Renders uploaded images.
 *
 * A plain `<img>` on purpose: `next/image` optimizes through a server-side fetch
 * that carries no session cookie, so an authenticated same-origin route like
 * `/api/attachments/<id>` would be answered with 401 and render as a broken
 * image. The uploader and staff are the only identities the route accepts.
 */
export function AttachmentList({ uploads }: { uploads: Attachment[] }) {
  if (!uploads.length) return null;

  return (
    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Attachments
      </h4>
      <ul className="grid gap-3 sm:grid-cols-2">
        {uploads.map((upload) => {
          const src = `/api/attachments/${upload.id}`;
          return (
            <li key={upload.id} className="space-y-1">
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-md border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={upload.originalName}
                  loading="lazy"
                  decoding="async"
                  className="mx-auto h-40 w-full object-contain"
                />
              </a>
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
    </div>
  );
}
