import Link from "next/link";

import type { MyIssuesCounts, MyIssuesView } from "@/lib/my-issues-view";

const MY_ISSUES_PATH = "/dashboard/my-issues";

/** "All" is the bare path, so the default view has one canonical URL. */
export function myIssuesViewHref(view: MyIssuesView): string {
  return view === "all" ? MY_ISSUES_PATH : `${MY_ISSUES_PATH}?view=${view}`;
}

const TILES: { view: MyIssuesView; label: string; dot: string }[] = [
  { view: "all", label: "All issues", dot: "bg-slate-400" },
  { view: "action", label: "Needs your reply", dot: "bg-amber-500" },
  { view: "active", label: "In progress", dot: "bg-cyan-500" },
  { view: "closed", label: "Closed", dot: "bg-emerald-500" },
];

type Tone = "selected" | "attention" | "default";

const toneClass: Record<Tone, string> = {
  selected:
    "border-cyan-500 bg-cyan-50 ring-1 ring-cyan-500 dark:border-cyan-400 dark:bg-cyan-400/10 dark:ring-cyan-400",
  attention:
    "border-amber-300 bg-amber-50 hover:border-amber-400 dark:border-amber-400/40 dark:bg-amber-400/10 dark:hover:border-amber-400/70",
  default:
    "border-slate-200 bg-white hover:border-cyan-400/60 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-cyan-500/50",
};

/**
 * Count tiles that double as the list filter.
 *
 * Plain links to `?view=…`, rendered on the server: the filter survives a reload,
 * a shared link and the auto-refresh (`router.refresh()` keeps the URL), and works
 * without client JS. "Needs your reply" turns amber while anything waits on the
 * student, so the one bucket that needs them stands out before they click.
 */
export function MyIssuesFilter({ counts, view }: { counts: MyIssuesCounts; view: MyIssuesView }) {
  return (
    <nav aria-label="Filter my issues">
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((tile) => {
          const selected = tile.view === view;
          const tone: Tone = selected
            ? "selected"
            : tile.view === "action" && counts.action > 0
              ? "attention"
              : "default";

          return (
            <li key={tile.view}>
              <Link
                aria-current={selected ? "page" : undefined}
                className={`flex min-h-24 flex-col justify-between gap-3 rounded-2xl border p-4 shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white motion-reduce:transition-none dark:focus-visible:ring-offset-slate-950 ${toneClass[tone]}`}
                data-tone={tone}
                href={myIssuesViewHref(tile.view)}
                scroll={false}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${tile.dot}`} />
                  {tile.label}
                </span>
                <span className="text-3xl font-bold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white">
                  {counts[tile.view]}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
