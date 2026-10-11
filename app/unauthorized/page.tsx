import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-50 px-4 dark:bg-slate-950">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora-blob absolute -left-24 -top-24 h-80 w-80 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 blur-[110px]" />
        <div
          className="aurora-blob absolute -bottom-28 -right-16 h-96 w-96 rounded-full bg-gradient-to-tr from-violet-500/15 to-cyan-500/15 blur-[120px]"
          style={{ animationDelay: "-8s" }}
        />
      </div>

      <section className="glass relative w-full max-w-md rounded-3xl p-6 text-center">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-danger">Access Denied</h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            You do not have permission to view this page.
          </p>
        </div>
        <Link
          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-600"
          href="/dashboard"
        >
          Back to Dashboard
        </Link>
      </section>
    </div>
  );
}
