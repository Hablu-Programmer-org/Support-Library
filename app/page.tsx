import Link from "next/link";

import { auth } from "@/auth";
import { LibrarySearch } from "@/components/landing/library-search";
import { CheckCircleIcon, FileTextIcon, MessageSquareIcon } from "@/components/icons";
import { Topbar } from "@/components/layout/topbar";
import { canCreateIssue, canMutate } from "@/lib/roles";

export const dynamic = "force-dynamic";

const primaryCtaClass =
  "inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-600";

const features = [
  {
    icon: FileTextIcon,
    title: "Published answers",
    body: "Browse curated fixes and walkthroughs your team has already published for learners.",
  },
  {
    icon: MessageSquareIcon,
    title: "Always up to date",
    body: "Edits are version-free and instant, so everyone reads the same current answer.",
  },
  {
    icon: CheckCircleIcon,
    title: "Curated answers",
    body: "Internal notes stay private while published answers reach the people who need them.",
  },
];

export default async function Home() {
  const session = await auth();
  const role = session?.user?.role;
  const canManage = canMutate(role ?? "STUDENT");
  const canSubmit = canCreateIssue(role);

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora-blob absolute -left-32 top-[-12%] h-[28rem] w-[28rem] rounded-full bg-gradient-to-br from-cyan-500/25 to-violet-500/20 blur-[120px]" />
        <div
          className="aurora-blob absolute right-[-12%] top-1/3 h-[26rem] w-[26rem] rounded-full bg-gradient-to-tr from-violet-500/20 to-cyan-500/15 blur-[120px]"
          style={{ animationDelay: "-7s" }}
        />
      </div>

      <Topbar user={session?.user} />

      <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-center px-6 py-24">
        <div className="max-w-3xl space-y-8">
          <span className="glass inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-cyan-700 dark:text-cyan-200">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-violet-500" />
            Hablu Programmer Staff Tool
          </span>

          <div className="space-y-5">
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-6xl">
              Simplify support for your <span className="brand-text">team</span>
            </h1>
            <p className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">
              A fast, searchable knowledge base for Hablu Programmer support — publish
              solutions once and let the whole team reuse them.
            </p>
          </div>

          {session?.user ? <LibrarySearch /> : null}

          <div className="flex flex-wrap items-center gap-3">
            {canManage ? (
              <Link className={primaryCtaClass} href="/dashboard">
                Open dashboard
              </Link>
            ) : null}
            {!canManage && canSubmit ? (
              <Link className={primaryCtaClass} href="/dashboard/issues/new">
                Submit a support request
              </Link>
            ) : null}
            <Link
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white/70 px-6 py-3 text-sm font-semibold text-slate-700 backdrop-blur transition hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900"
              href={session?.user ? "/dashboard/issues" : "/login"}
            >
              {session?.user ? "Browse issues" : "Staff Sign In"}
            </Link>
          </div>

          <div className="grid gap-4 pt-6 sm:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="glass rounded-2xl p-5 transition hover:-translate-y-0.5"
                >
                  <span className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/15 to-violet-500/15 text-cyan-600 ring-1 ring-cyan-500/20 dark:text-cyan-300">
                    <Icon size={20} />
                  </span>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    {feature.title}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                    {feature.body}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </main>
  );
}
