import Link from "next/link";
import { ArrowLeftIcon, HelpCircleIcon, SparklesIcon } from "@/components/icons";
import { IssueForm } from "@/components/issues/issue-form";
import { StickyActionBar } from "@/components/issues/sticky-action-bar";
import { requireMentorOrAdmin } from "@/lib/auth-guard";

export const dynamic = "force-dynamic";

export default async function NewIssuePage() {
  await requireMentorOrAdmin();

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950">
      {/* Sticky Header */}
      <header className="sticky top-0 z-20 w-full border-b border-slate-200 bg-white/95 backdrop-blur-sm px-4 py-3 dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
          <Link
            href="/dashboard/issues"
            className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
            aria-label="Back to Issues"
          >
            <ArrowLeftIcon size={18} />
            Back to Issues
          </Link>
          <div className="flex-1" />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-4xl mx-auto px-4 py-6">
        <div className="space-y-6">
          {/* Page Title & Description */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400" aria-hidden="true">
                <SparklesIcon size={20} />
              </span>
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">New Support Issue</h1>
                <p className="text-slate-600 dark:text-slate-400">Create a new support issue for a student. Fill in the required fields and add an optional answer.</p>
              </div>
            </div>
          </div>

          {/* Quick Tips */}
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50" aria-labelledby="tips-heading">
            <h2 id="tips-heading" className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
              <HelpCircleIcon size={16} />
              Quick Tips
            </h2>
            <ul className="mt-2 grid gap-2 text-sm text-slate-600 dark:text-slate-400 sm:grid-cols-2">
              <li className="flex items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">1</span>Enter student email first to auto-fill name from LMS</li>
              <li className="flex items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">2</span>Title must be at least 5 characters</li>
              <li className="flex items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">3</span>Add an answer to resolve the issue immediately</li>
              <li className="flex items-center gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">4</span>Use Cmd+Enter to submit quickly</li>
            </ul>
          </section>

          {/* Form */}
          <IssueForm minimal />

          {/* Sticky Action Bar */}
          <StickyActionBar>
            <form action="/dashboard/issues/new" className="w-full">
              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-slate-950"
              >
                <span>Create Issue</span>
                <kbd className="hidden items-center justify-center rounded bg-slate-200 px-1.5 py-0.5 text-xs font-mono text-slate-600 dark:bg-slate-700 dark:text-slate-300 md:inline-flex">⌘Enter</kbd>
              </button>
            </form>
          </StickyActionBar>
        </div>
      </main>
    </div>
  );
}