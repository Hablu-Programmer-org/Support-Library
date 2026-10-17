import Link from "next/link";

/**
 * Shared body for the two not-found boundaries (root and dashboard).
 * Keeping it in one place means the 404 the user sees from a deep
 * dashboard route and the 404 from an unknown top-level URL look the
 * same and both offer a way back.
 */
export function NotFoundContent() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center px-4">
      <section className="w-full max-w-md p-6 text-center">
        <div className="mb-6 flex flex-col items-center">
          <h1 className="text-2xl font-bold">404</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            This page could not be found.
          </p>
        </div>
        <div className="space-y-3">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            The link may be incorrect, or the record may have been archived.
          </p>
          <Link
            href="/dashboard"
            className="block w-full rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
          >
            Go to Dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
