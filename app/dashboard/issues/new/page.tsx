import {
  ArrowLeftIcon,
  SparklesIcon,
} from "@/components/icons";
import { BeforeSubmitGuide } from "@/components/issues/before-submit-guide";
import { IssueForm } from "@/components/issues/issue-form";
import { StudentIssueForm } from "@/components/issues/student-issue-form";
import { QuickTips } from "@/components/issues/quick-tips";
import { requireIssueCreator } from "@/lib/auth-guard";
import { listStudentCourses } from "@/lib/lms";
import { canMutate } from "@/lib/roles";
import Link from "next/link";
import { generateCsrfToken } from "@/lib/csrf";

export const dynamic = "force-dynamic";

export default async function NewIssuePage() {
  const session = await requireIssueCreator();
  const canManage = Boolean(session.user.role && canMutate(session.user.role));
  const csrfToken = await generateCsrfToken(session.user.id);

  if (!canManage) {
    const courses = await listStudentCourses(session.user.email);

    return (
      <div className="flex flex-col">
        <header className="w-full px-4 py-3">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
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

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <div className="space-y-2">
              <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    Submit a support request
                  </h1>
                  <p className="text-slate-600 dark:text-slate-400">
                     Describe the issue clearly so the support team can help
                     faster.
                  </p>
              </div>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-8">
              <div className="order-2 min-w-0 lg:order-1">
                <StudentIssueForm courses={courses} csrfToken={csrfToken} />
              </div>
              <div className="order-1 min-w-0 lg:order-2">
                <BeforeSubmitGuide />
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Back link */}
      <header className="w-full px-4 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        <div className="space-y-6">
          {/* Page Title & Description */}
          <div className="space-y-2">
            <div className="flex items-start gap-3">
              <SparklesIcon
                size={20}
                className="mt-1.5 shrink-0 text-slate-400 dark:text-slate-500"
              />
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
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
