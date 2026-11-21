import Link from "next/link";
import type { ReactNode } from "react";

import { ArrowLeftIcon, ArrowRightIcon, CaseIcon, SearchIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { buildPageList } from "@/lib/pagination";

const primaryActionClass =
  "inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-primary-600";

/** Shared frame for "nothing to show" states: icon bubble, message, way out. */
export function ListStatePanel({
  icon,
  title,
  description,
  children,
  tone = "neutral",
}: {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="relative isolate overflow-hidden rounded-3xl border border-dashed border-slate-300 bg-white/60 px-5 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-6 -z-10 size-40 -translate-x-1/2 rounded-full bg-cyan-400/10 blur-3xl"
      />
      <span
        aria-hidden="true"
        className={cn(
          "mx-auto flex size-14 items-center justify-center rounded-2xl ring-1 ring-inset motion-safe:animate-[issue-state-float_3.5s_ease-in-out_infinite]",
          tone === "warning"
            ? "bg-amber-500/15 text-amber-600 ring-amber-500/30 dark:text-amber-300"
            : "bg-cyan-500/15 text-cyan-600 ring-cyan-500/30 dark:text-cyan-300",
        )}
      >
        {icon}
      </span>
      <p className="mt-4 text-base font-semibold text-slate-900 wrap-break-word dark:text-slate-50">
        {title}
      </p>
      {description && (
        <p className="mx-auto mt-1 max-w-md text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

/** A keyword that matched nothing: clear it, or start from a tag. */
export function NoResultsState({
  query,
  clearHref,
  tags,
}: {
  query: string;
  clearHref: string;
  tags: { tag: string; href: string }[];
}) {
  return (
    <ListStatePanel
      description="Try fewer words, a different spelling, or browse a tag."
      icon={<SearchIcon size={26} />}
      title={<>No results for “{query}”.</>}
    >
      <Link className={primaryActionClass} href={clearHref}>
        Clear search
      </Link>
      {tags.length > 0 && (
        <ul className="mt-5 flex flex-wrap justify-center gap-2" aria-label="Browse a tag">
          {tags.slice(0, 8).map(({ tag, href }) => (
            <li key={tag}>
              <Link
                className="inline-flex max-w-48 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-cyan-500/60 dark:hover:text-cyan-300"
                href={href}
              >
                <span className="truncate">#{tag}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </ListStatePanel>
  );
}

/** No rows and no keyword: filters (or an empty library) left nothing. */
export function NoIssuesState({ action }: { action?: ReactNode }) {
  return (
    <ListStatePanel icon={<CaseIcon size={26} />} title="No issues found.">
      {action}
    </ListStatePanel>
  );
}

const pagerLinkClass =
  "inline-flex h-9 min-w-9 items-center justify-center gap-1 rounded-lg px-2.5 text-sm font-medium transition duration-150";
const pagerIdleClass =
  "border border-slate-200 bg-white text-slate-700 hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-500/60 dark:hover:text-cyan-300";

/**
 * "Page X of Y · Total N" plus a numbered pager. The summary text is asserted
 * by e2e and stays exactly as before; the pager hides for a single page, and
 * the numbers hide on phones where Previous/Next is enough.
 */
export function IssueListPagination({
  page,
  totalPages,
  total,
  hrefFor,
}: {
  page: number;
  totalPages: number;
  total: number;
  hrefFor: (page: number) => string;
}) {
  const items = buildPageList(page, totalPages);

  return (
    <div className="flex flex-col gap-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between dark:text-slate-400">
      <span>
        Page {page} of {totalPages} · Total {total}
      </span>
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1.5">
          {page > 1 && (
            <Link className={cn(pagerLinkClass, pagerIdleClass)} href={hrefFor(page - 1)} rel="prev">
              <ArrowLeftIcon aria-hidden="true" size={14} />
              Previous
            </Link>
          )}
          <ul className="hidden items-center gap-1.5 sm:flex">
            {items.map((item, index) =>
              item === "gap" ? (
                <li key={`gap-${index}`} aria-hidden="true" className="px-1 text-slate-400">
                  …
                </li>
              ) : (
                <li key={item}>
                  {item === page ? (
                    <span
                      aria-current="page"
                      className={cn(
                        pagerLinkClass,
                        "bg-cyan-500 font-semibold text-white",
                      )}
                    >
                      {item}
                    </span>
                  ) : (
                    <Link
                      aria-label={`Page ${item}`}
                      className={cn(pagerLinkClass, pagerIdleClass)}
                      href={hrefFor(item)}
                    >
                      {item}
                    </Link>
                  )}
                </li>
              ),
            )}
          </ul>
          {page < totalPages && (
            <Link className={cn(pagerLinkClass, pagerIdleClass)} href={hrefFor(page + 1)} rel="next">
              Next
              <ArrowRightIcon aria-hidden="true" size={14} />
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
