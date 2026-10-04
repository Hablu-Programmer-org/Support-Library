type FileLink = {
  title: string;
  url: string;
  type?: string | null;
  note?: string | null;
};

type VideoLink = {
  title: string;
  url: string;
  timestamp?: string | null;
  summary?: string | null;
};

const hostLabel = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "external";
  }
};

export function LinkList({ fileLinks, videoLinks }: { fileLinks: FileLink[]; videoLinks: VideoLink[] }) {
  if (!fileLinks.length && !videoLinks.length) return null;

  return (
    <div className="mt-4 space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
      {fileLinks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">File Links</h4>
          <div className="grid gap-2">
            {fileLinks.map((link) => (
              <a
                key={`${link.title}-${link.url}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-gray-200 p-3 text-sm transition hover:border-primary dark:border-gray-700"
              >
                <div className="font-medium text-primary">{link.title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {link.type ? `${link.type} · ` : ""}{hostLabel(link.url)}
                </div>
                {link.note && <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">{link.note}</div>}
              </a>
            ))}
          </div>
        </div>
      )}

      {videoLinks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Video Links</h4>
          <div className="grid gap-2">
            {videoLinks.map((link) => (
              <a
                key={`${link.title}-${link.url}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-gray-200 p-3 text-sm transition hover:border-primary dark:border-gray-700"
              >
                <div className="font-medium text-primary">{link.title}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {link.timestamp ? `${link.timestamp} · ` : ""}{hostLabel(link.url)}
                </div>
                {link.summary && <div className="mt-1 text-xs text-gray-600 dark:text-gray-300">{link.summary}</div>}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
