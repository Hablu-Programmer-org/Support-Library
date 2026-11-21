import Link from "next/link";

import { WarningTriangleIcon } from "@/components/icons";
import { ListStatePanel } from "@/components/issues/issue-list-states";

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
    <ListStatePanel
      description="Try a shorter or more specific query, or clear the search."
      icon={<WarningTriangleIcon size={26} />}
      title="Search is taking too long."
      tone="warning"
    >
      <Link
        className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition duration-150 hover:bg-primary-600"
        href={href}
      >
        Clear search
      </Link>
    </ListStatePanel>
  );
}
