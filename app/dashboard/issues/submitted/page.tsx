import { CheckCircleIcon } from "@/components/icons";
import { requireSession } from "@/lib/auth-guard";
import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Confirmation shown after a student submits an issue.
 *
 * Students never see the internal issue view (unpublished cases are staff-only),
 * so the submit flow ends here instead of redirecting to the case detail page.
 */
export default async function IssueSubmittedPage() {
  const session = await requireSession();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-10">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <span
          aria-hidden="true"
          className="mx-auto mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-success-100 text-success-700 dark:bg-success-950/50 dark:text-success-300"
        >
          <CheckCircleIcon size={28} />
        </span>

        <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">
          Your request has been submitted
        </h1>
        <p className="mt-3 text-slate-600 dark:text-slate-400">
          The Hablu Programmer support team has received your issue
          {session.user.email ? (
            <>
              {" "}
              and will reply to <span className="font-medium">{session.user.email}</span>.
            </>
          ) : (
            " and will get back to you shortly."
          )}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-600"
            href="/dashboard/issues/new"
          >
            Submit another request
          </Link>
          <Link
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            href="/dashboard/issues"
          >
            Browse the Support Library
          </Link>
        </div>
      </div>
    </div>
  );
}
