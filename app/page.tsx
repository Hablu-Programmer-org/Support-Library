import Link from "next/link";

import { auth } from "@/auth";
import { Topbar } from "@/components/layout/topbar";
import { LibrarySearch } from "@/components/landing/library-search";
import { canMutate } from "@/lib/roles";

export const dynamic = "force-dynamic";

const primaryCtaClass =
  "inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-600";

export default async function Home() {
  const session = await auth();
  const role = session?.user?.role;
  const canManage = canMutate(role ?? "VIEWER");

  return (
    <main className="min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      <Topbar user={session?.user} />

      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-center px-6 py-24">
        <div className="max-w-3xl space-y-8">
          <span className="inline-flex w-fit rounded-full border border-primary-400/40 bg-primary-500/10 px-4 py-2 text-sm font-medium text-primary-700 dark:text-primary-200">
            Hablu Programmer Staff Tool
          </span>
          <div className="space-y-5">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              Simplify support for your team
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
              Keep student questions, answers, file links and video guides in one searchable workspace built for your support team.
            </p>
          </div>

          {session?.user && <LibrarySearch />}

          <div className="flex flex-wrap items-center gap-3">
            {!session?.user ? (
              <Link className={primaryCtaClass} href="/login">
                Staff Sign In
              </Link>
            ) : canManage ? (
              <Link className={primaryCtaClass} href="/dashboard">
                Go to Dashboard
              </Link>
            ) : (
              <Link className={primaryCtaClass} href="/dashboard/issues">
                Browse Published Solutions
              </Link>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
