import {
  ArrowLeftIcon,
  HelpCircleIcon,
  SparklesIcon,
} from "@/components/icons";
import { IssueForm } from "@/components/issues/issue-form";
import { StudentIssueForm } from "@/components/issues/student-issue-form";
import { QuickTips } from "@/components/issues/quick-tips";
import { requireIssueCreator } from "@/lib/auth-guard";
import { canMutate } from "@/lib/roles";
import Link from "next/link";
import { generateCsrfToken } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export default async function NewIssuePage() {
  const session = await requireIssueCreator();
  const canManage = Boolean(session.user.role && canMutate(session.user.role));
  const csrfToken = await generateCsrfToken(session.user.id);

  if (!canManage) {
    return (
      <div className="flex flex-col">
        <header className="w-full px-4 py-3">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4">
            <Link
              href="/dashboard/issues"
              className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              aria-label="Back to Support Library"
            >
              <ArrowLeftIcon size={18} />
              Back to Support Library
            </Link>
            <div className="flex-1" />
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
                  aria-hidden="true"
                >
                  <SparklesIcon size={20} />
                </span>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Submit a support request
                  </h1>
                  <p className="text-slate-600 dark:text-slate-400">
                    Describe your problem and the support team will get back to you
                    by email.
                  </p>
                </div>
              </div>
            </div>

            <section
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50"
              aria-labelledby="tips-heading"
            >
              <h2
                id="tips-heading"
                className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300"
              >
                <HelpCircleIcon size={16} />
                Before you submit
              </h2>
              <ul className="mt-2 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                <li>Search the Support Library first — your answer may already be published.</li>
                <li>One problem per request keeps it easy to track.</li>
                <li>Replies are not available here; the team answers you by email.</li>
              </ul>
            </section>

            <StudentIssueForm csrfToken={csrfToken} email={session.user.email} />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Back link */}
      <header className="w-full px-4 py-3">
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
            <div className="flex items-start gap-3">
              <span
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400"
                aria-hidden="true"
              >
                <SparklesIcon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                  New Support Issue
                </h1>
                <p className="text-slate-600 dark:text-slate-400">
                  Create a new support issue for a student. Fill in the required
                  fields and add an optional answer.
                </p>
              </div>
              <QuickTips
                tips={[
                  "Describe the issue — this is the main part.",
                  "Add an answer to resolve the issue immediately.",
                  "Student Identity is optional — add name and email only for a specific student.",
                  "Use Cmd+Enter or Ctrl+Enter to submit quickly.",
                ]}
              />
            </div>
          </div>

          {/* Form */}
          <IssueForm minimal csrfToken={csrfToken} />
        </div>
      </main>
    </div>
  );
}
