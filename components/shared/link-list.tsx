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
      <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
        Video Links
      </h4>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {videoLinks.map((link) => (
          <li key={`${link.title}-${link.url}`} className="py-2">
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-primary hover:underline"
            >
              {link.title}
            </a>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {link.timestamp ? `${link.timestamp} · ` : ""}{hostLabel(link.url)}
              {link.summary ? ` · ${link.summary}` : ""}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
