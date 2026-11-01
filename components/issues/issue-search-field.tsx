"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { ChevronDownIcon, SearchIcon } from "@/components/icons";
import { nativeFieldClass } from "@/lib/config/fields";
import { buildIssueListHref, type IssueFilterDefaults } from "@/lib/issue-list-params";

const DEBOUNCE_MS = 400;

/**
 * Keyword box that searches while you type.
 *
 * Staff were expected to press Enter or open the advanced panel to find the
 * `Filter` button, which made a one-line search feel like a form. Typing now
 * navigates by itself once the input pauses; the URL still carries the query, so
 * a result page can be bookmarked or shared, and Enter keeps working.
 */
export function IssueSearchField({
  defaults,
  open,
  onToggle,
}: {
  defaults: IssueFilterDefaults;
  open: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaults.q);
  const [isPending, startTransition] = useTransition();
  const lastApplied = useRef(defaults.q);

  // Re-sync with the server value: Reset, back/forward and a submitted form all
  // arrive as new props.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirrors a server prop change, same pattern as the panel
    setValue(defaults.q);
    lastApplied.current = defaults.q;
  }, [defaults.q]);

  useEffect(() => {
    const next = value.trim();
    if (next === lastApplied.current) return;

    const timer = window.setTimeout(() => {
      // A search always restarts at page 1: the old page number would point at a
      // different result set. Everything else in the URL is kept.
      const href = buildIssueListHref({ ...defaults, q: next, page: 1 });

      lastApplied.current = next;
      // `replace`, not `push`: a search should not fill the back button with one
      // history entry per pause.
      startTransition(() => {
        router.replace(href, { scroll: false });
      });
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [value, defaults, router]);

  return (
    <div className="relative">
      <SearchIcon
        className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${
          isPending ? "animate-pulse text-primary" : "text-slate-400"
        }`}
        size={18}
      />
      <input
        aria-label="Search issues"
        className={`${nativeFieldClass} px-10`}
        enterKeyHint="search"
        name="q"
        placeholder="Search by problem, keyword or 6-digit reference"
        type="search"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button
        aria-expanded={open}
        aria-label="Advanced filters"
        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        onClick={onToggle}
        type="button"
      >
        <ChevronDownIcon
          className={`transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          size={18}
        />
      </button>
      <span aria-live="polite" className="sr-only">
        {isPending ? "Searching" : ""}
      </span>
    </div>
  );
}
