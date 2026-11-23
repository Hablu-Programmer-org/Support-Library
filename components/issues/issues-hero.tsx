import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { BROWSE_TAG_LIMIT } from "@/lib/issue-tags";

/** Tag chips shown under the hero; more than this turns into noise. */
export const ISSUES_HERO_MAX_TAGS = BROWSE_TAG_LIMIT;

export type IssuesHeroTag = { tag: string; href: string; active: boolean };

/**
 * Student header for the issues list.
 *
 * The search box is not rendered here: it stays in the sticky filter form (one
 * `q` input, still submitted by "Filter"). The floating filter form is pulled up
 * into this section's `pb-[152px]` so the search card sits fully inside the hero.
 * The offset lives in `issue-filter-panel.tsx` (`stickyBarClass`); change both.
 */
export function IssuesHero({
  title,
  description,
  actions,
  tags,
}: {
  /** The page <h1>; e2e asserts this exact text. */
  title: string;
  description?: string;
  actions?: ReactNode;
  tags: IssuesHeroTag[];
}) {
  const visibleTags = tags.slice(0, ISSUES_HERO_MAX_TAGS);

  return (
    <section
      aria-labelledby="issues-hero-title"
      className="relative isolate overflow-hidden rounded-3xl border border-slate-200 bg-white px-5 pb-[152px] pointer-coarse:pb-[164px] pt-5 sm:px-6 sm:pt-6 dark:border-slate-800 dark:bg-slate-900/60"
    >
      {/* Decorative brand light; static so it costs nothing on scroll. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 -top-28 size-72 rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/15" />
        <div className="absolute -right-20 -top-16 size-64 rounded-full bg-violet-400/20 blur-3xl dark:bg-violet-500/15" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-cyan-400/40 to-transparent" />
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <h1
            id="issues-hero-title"
            className="text-2xl font-bold tracking-tight text-slate-950 sm:text-[1.75rem] dark:text-white"
          >
            {title}
          </h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-400">
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-end gap-2">{actions}</div>}
      </div>

      {visibleTags.length > 0 && (
        <nav aria-label="Popular tags" className="mt-4">
          <ul className="flex flex-wrap gap-2">
            {visibleTags.map(({ tag, href, active }) => (
              <li key={tag}>
                <Link
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    // Touch: 36px chip + 4px invisible hit area each side = 44px,
                    // exactly filling the 8px gap between rows without overlap.
                    "relative inline-flex max-w-48 items-center rounded-full border px-3 py-1 text-xs font-semibold transition after:absolute after:-inset-1 after:content-[''] pointer-coarse:min-h-9 duration-150 motion-safe:hover:-translate-y-px",
                    active
                      ? "border-cyan-500 bg-cyan-500 text-white shadow-sm shadow-cyan-500/30"
                      : "border-slate-200 bg-white/70 text-slate-700 hover:border-cyan-400 hover:text-cyan-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-cyan-500/60 dark:hover:text-cyan-300",
                  )}
                  href={href}
                >
                  <span className="truncate">#{tag}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </section>
  );
}
