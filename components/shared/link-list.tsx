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

export function LinkList({ videoLinks }: { videoLinks: VideoLink[] }) {
  if (!videoLinks.length) return null;

  return (
    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-slate-800">
      {videoLinks.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Video Links</h4>
          <div className="grid gap-2">
            {videoLinks.map((link) => (
              <a
                key={`${link.title}-${link.url}`}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-slate-200 p-3 text-sm transition hover:border-primary dark:border-slate-700"
              >
                <div className="font-medium text-primary">{link.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {link.timestamp ? `${link.timestamp} · ` : ""}{hostLabel(link.url)}
                </div>
                {link.summary && <div className="mt-1 text-xs text-slate-600 dark:text-slate-300">{link.summary}</div>}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
