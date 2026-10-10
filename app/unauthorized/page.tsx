import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-danger">Access Denied</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            You do not have permission to view this page.
          </p>
        </div>
        <Link href="/dashboard" className="text-primary hover:underline">
          Back to Dashboard
        </Link>
      </section>
    </div>
  );
}
