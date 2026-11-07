import Link from "next/link";

/**
 * The recoverable search-timeout state.
 *
 * A `maxTimeMS` exceedance is rendered as a notice with a way out (clear the
 * search) instead of an error boundary. Extracted so the recovery UI is
 * component-testable without booting the whole list page (session, mentors,
 * enrolment, …).
 */
export function SearchTimeoutNotice({ href }: { href: string }) {
  return (
    <div className="px-4 py-10 text-center">
      <p className="font-semibold">Search is taking too long.</p>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Try a shorter or more specific query, or clear the search.
      </p>
      <Link
        className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary-100 px-3 py-1.5 text-sm font-semibold text-primary-700 transition hover:bg-primary-200 dark:bg-primary-900 dark:text-primary-100 dark:hover:bg-primary-800"
        href={href}
      >
        Clear search
      </Link>
    </div>
  );
}
