import Link from "next/link";

import { auth } from "@/auth";
import { LibrarySearch } from "@/components/landing/library-search";
import {
  CaseIcon,
  CheckCircleIcon,
  FileTextIcon,
  MessageSquareIcon,
  SparklesIcon,
  VideoIcon,
} from "@/components/icons";
import { Topbar } from "@/components/layout/topbar";
import { canCreateIssue, canMutate, type UserRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

const primaryCtaClass =
  "inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-150 hover:bg-primary-600 motion-reduce:transition-none";

const secondaryCtaClass =
  "inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white/70 px-6 py-3 text-sm font-semibold text-slate-700 backdrop-blur transition-colors duration-150 hover:bg-white dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:bg-slate-900";

const cardClass =
  "group flex flex-col rounded-2xl border border-slate-200 bg-white/70 p-5 backdrop-blur transition-colors duration-150 hover:border-cyan-400/70 hover:bg-white motion-reduce:transition-none dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-cyan-800 dark:hover:bg-slate-900";

const cardIconClass =
  "mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500/15 to-violet-500/15 text-cyan-600 ring-1 ring-cyan-500/20 dark:text-cyan-300";

type LandingCard = {
  icon: typeof FileTextIcon;
  title: string;
  body: string;
  href?: string;
  cta?: string;
};

type LandingCopy = {
  badge: string;
  /** Headline pieces so one word can keep the brand gradient. */
  lead: string;
  highlight: string;
  rest: string;
  description: string;
  cards: LandingCard[];
};

function copyFor(role: UserRole | undefined): {
  staff: boolean;
  student: boolean;
  copy: LandingCopy;
} {
  const staff = Boolean(role && canMutate(role));
  const student = !staff && canCreateIssue(role);

  if (staff) {
    return {
      staff,
      student,
      copy: {
        badge: "Hablu Programmer Staff Tool",
        lead: "Support operations,",
        highlight: "answers",
        rest: "and student requests.",
        description:
          "Search the knowledge base, answer student requests, and keep the support queue moving.",
        cards: [
          {
            icon: CaseIcon,
            title: "Answer requests",
            body: "Unanswered student requests first, with the full case history in one place.",
            href: "/dashboard/issues",
            cta: "Open issue queue",
          },
          {
            icon: VideoIcon,
            title: "Live support",
            body: "See who is waiting in the room and join during the support schedule.",
            href: "/dashboard/support",
            cta: "Open live support",
          },
          {
            icon: CheckCircleIcon,
            title: "Track delivery",
            body: "Check the support queue and the access requests that still need action.",
            href: "/dashboard",
            cta: "Open dashboard",
          },
        ],
      } satisfies LandingCopy,
    };
  }

  if (student) {
    return {
      staff,
      student,
      copy: {
        badge: "Hablu Programmer Student Support",
        lead: "Find answers. Get the",
        highlight: "help",
        rest: "you need.",
        description:
          "Search published solutions, track your requests, or access support for your course.",
        cards: [
          {
            icon: FileTextIcon,
            title: "Published answers",
            body: "Verified fixes and walkthroughs the team has already published.",
            href: "/dashboard/issues",
            cta: "Browse answers",
          },
          {
            icon: MessageSquareIcon,
            title: "My requests",
            body: "Follow the team's reply and any update on what you submitted.",
            href: "/dashboard/my-requests",
            cta: "View my requests",
          },
          {
            icon: VideoIcon,
            title: "Live support",
            body: "See availability and join from your own support request.",
            href: "/dashboard/my-requests",
            cta: "Open my requests",
          },
        ],
      } satisfies LandingCopy,
    };
  }

  return {
    staff,
    student,
    copy: {
      badge: "Hablu Programmer Support",
      lead: "Find answers from",
      highlight: "Hablu Programmer",
      rest: "Support.",
      description:
        "Browse published solutions from the support library, or sign in to manage your own requests.",
      cards: [
        {
          icon: FileTextIcon,
          title: "Published answers",
          body: "Browse curated fixes and walkthroughs published for learners.",
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
      ],
    } satisfies LandingCopy,
  };
}

export default async function Home() {
  const session = await auth();
  const role = session?.user?.role;
  const { copy, staff, student } = copyFor(role);

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="aurora-blob absolute -left-32 top-[-12%] h-112 w-md rounded-full bg-linear-to-br from-cyan-500/25 to-violet-500/20 blur-[120px]" />
        <div
          className="aurora-blob absolute right-[-12%] top-1/3 h-104 w-104 rounded-full bg-linear-to-tr from-violet-500/20 to-cyan-500/15 blur-[120px]"
          style={{ animationDelay: "-7s" }}
        />
      </div>

      <Topbar user={session?.user} />

      <section className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-24 sm:px-6 sm:pt-28 lg:px-8">
        <div className="mx-auto w-full max-w-3xl text-center">
          <span className="glass inline-flex w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-cyan-700 dark:text-cyan-200">
            <span className="h-1.5 w-1.5 rounded-full bg-linear-to-r from-cyan-500 to-violet-500" />
            {copy.badge}
          </span>

          <h1 className="mt-6 text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            {copy.lead} <span className="brand-text">{copy.highlight}</span> {copy.rest}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-slate-600 sm:text-lg dark:text-slate-300">
            {copy.description}
          </p>

          {session?.user ? (
            <div className="mx-auto mt-8 flex w-full max-w-xl justify-center">
              <LibrarySearch />
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {staff ? (
              <>
                <Link className={primaryCtaClass} href="/dashboard">
                  Open dashboard
                </Link>
                <Link className={secondaryCtaClass} href="/dashboard/issues">
                  Browse issues
                </Link>
              </>
            ) : student ? (
              <>
                <Link className={primaryCtaClass} href="/dashboard/issues">
                  Browse answers
                </Link>
                <Link className={secondaryCtaClass} href="/dashboard/my-requests">
                  My requests
                </Link>
              </>
            ) : (
              <Link className={primaryCtaClass} href="/login">
                Staff Sign In
              </Link>
            )}
          </div>

          {/* Access requests keep a single write path: the student dashboard
              owns the form, so the landing page only points at it. No extra LMS
              lookup and no second submit surface. */}
          {student ? (
            <div className="mx-auto mt-8 flex w-full max-w-xl flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/60">
              <div className="flex min-w-0 items-start gap-3">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300"
                >
                  <SparklesIcon size={18} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    AI Agent course
                  </p>
                  <p className="mt-0.5 text-xs leading-5 text-slate-600 dark:text-slate-400">
                    Need n8n access, password reset or OpenAI access?
                  </p>
                </div>
              </div>
              <Link
                className="inline-flex shrink-0 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors duration-150 hover:border-cyan-400 hover:text-cyan-800 motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-700 dark:hover:text-cyan-200"
                href="/dashboard/issues"
              >
                Help &amp; access →
              </Link>
            </div>
          ) : null}
        </div>

        <div className="mx-auto mt-12 grid w-full max-w-5xl gap-4 sm:grid-cols-3">
          {copy.cards.map((card) => {
            const Icon = card.icon;
            const content = (
              <>
                <span className={cardIconClass}>
                  <Icon size={20} />
                </span>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {card.title}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{card.body}</p>
                {card.cta ? (
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                    {card.cta}
                    <span aria-hidden>→</span>
                  </span>
                ) : null}
              </>
            );

            return card.href ? (
              <Link key={card.title} className={cardClass} href={card.href}>
                {content}
              </Link>
            ) : (
              <div key={card.title} className={cardClass}>
                {content}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
