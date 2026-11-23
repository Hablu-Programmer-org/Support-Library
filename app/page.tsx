import Link from "next/link";
import type { CSSProperties } from "react";

import { auth } from "@/auth";
import { ArrowRightIcon, SparklesIcon } from "@/components/icons";
import { LibrarySearch } from "@/components/landing/library-search";
import { Topbar } from "@/components/layout/topbar";
import { copyFor, type LandingCta } from "@/lib/landing-copy";
import { liveSupportNow } from "@/lib/live-support-status";

export const dynamic = "force-dynamic";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500";

// bg-primary stays the computed background-color (shell.spec asserts cyan-500);
// the glow is a shadow so it never changes that. Dark text, not white: white on
// cyan-500 is 2.42:1, slate-950 is ~8.6:1 (and ~5.5:1 on the hover shade).
const primaryCtaClass = `group inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-slate-950 shadow-[0_10px_30px_-10px_rgb(6_182_212/0.7)] transition-[transform,box-shadow,background-color] duration-200 hover:-translate-y-0.5 hover:bg-primary-600 hover:shadow-[0_16px_40px_-12px_rgb(139_92_246/0.7)] active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${focusRing}`;

const secondaryCtaClass = `group inline-flex items-center justify-center gap-2 rounded-full border border-slate-300 bg-white/70 px-6 py-3 text-sm font-semibold text-slate-700 backdrop-blur transition-[transform,border-color,background-color] duration-200 hover:-translate-y-0.5 hover:border-cyan-400 hover:bg-white active:translate-y-0 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-cyan-700 dark:hover:bg-slate-900 ${focusRing}`;

const cardBaseClass =
  "landing-card flex h-full flex-col rounded-2xl border border-slate-200 bg-white/70 p-6 backdrop-blur dark:border-slate-800 dark:bg-slate-900/60";

// Only link cards react to hover; a static guest card must not look clickable.
// Tailwind v4 `hover:` already applies only on devices that can hover, and
// `-translate-y-1` uses the `translate` property, so it never fights the
// reveal animation's `transform`.
const cardLinkClass = `${cardBaseClass} group transition-[translate,background-color] duration-200 ease-out hover:-translate-y-1 hover:bg-white motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:hover:bg-slate-900 ${focusRing}`;

const cardIconClass =
  "mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-cyan-500/15 to-violet-500/15 text-cyan-600 ring-1 ring-cyan-500/20 transition-transform duration-200 ease-out group-hover:scale-110 group-hover:-rotate-3 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-hover:rotate-0 dark:text-cyan-300";

/** Entrance order for the hero, in ms. One step = one visual beat. */
const delay = (ms: number) =>
  ({ "--landing-delay": `${ms}ms` }) as CSSProperties;

function HeroCta({ cta }: { cta: LandingCta }) {
  const primary = cta.variant === "primary";
  return (
    <Link
      className={primary ? primaryCtaClass : secondaryCtaClass}
      href={cta.href}
    >
      {cta.label}
      {primary ? (
        <ArrowRightIcon
          size={16}
          className="transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
        />
      ) : null}
    </Link>
  );
}

function HeroBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <div className="landing-grid absolute inset-x-0 top-0 h-[42rem]" />
      {/* Radial gradients instead of blur filters: same soft glow, a fraction
          of the paint cost, and smaller on phones. */}
      <div
        className="landing-glow absolute left-[-20%] top-[-18%] h-112 w-md rounded-full sm:h-160 sm:w-160"
        style={{
          backgroundImage:
            "radial-gradient(closest-side, rgb(6 182 212 / 0.28), rgb(6 182 212 / 0.08) 55%, transparent)",
        }}
      />
      <div
        className="landing-glow absolute -right-[18%] top-[14%] h-[24rem] w-[24rem] rounded-full sm:h-[36rem] sm:w-[36rem]"
        style={{
          backgroundImage:
            "radial-gradient(closest-side, rgb(139 92 246 / 0.24), rgb(139 92 246 / 0.07) 55%, transparent)",
          animationDelay: "-11s",
        }}
      />
    </div>
  );
}

export default async function Home() {
  const session = await auth();
  const { copy, student } = copyFor(session?.user?.role);
  const signedIn = Boolean(session?.user);
  const live = liveSupportNow(new Date());

  return (
    // overflow-clip, not overflow-hidden: `hidden` makes <main> a scroll
    // container, which captures the cards' `view()` timeline and stops the
    // scroll reveal. `clip` still keeps the glow from causing page scroll.
    <main className="relative min-h-screen overflow-clip bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      <HeroBackdrop />

      <Topbar user={session?.user} />

      <section className="relative mx-auto w-full max-w-6xl px-4 pb-20 pt-28 sm:px-6 sm:pt-36 lg:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center text-center">
          {/* Live support status from the schedule only (no room link), so
              it is the same safe fact for guests, students and staff. The
              ping only runs while support is actually open. */}
          <span
            className="landing-rise glass inline-flex w-fit items-center gap-2.5 rounded-full px-4 py-2 text-sm font-medium text-cyan-700 dark:text-cyan-200"
            style={delay(0)}
          >
            <span aria-hidden className="relative flex h-2 w-2">
              {live.open ? (
                <span className="landing-ping absolute inset-0 rounded-full bg-emerald-400" />
              ) : null}
              <span
                className={`relative h-2 w-2 rounded-full ${live.open ? "bg-emerald-500" : "bg-slate-400"}`}
              />
            </span>
            {live.label}
          </span>

          <h1
            className="landing-slide mt-7 text-balance text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl"
            style={delay(60)}
          >
            {copy.lead}{" "}
            {/* On phones the highlight can wrap, so it stays inline text and
                the underline (which would only sit under the last line) is
                shown from sm up, where the phrase fits on one line. */}
            <span className="relative sm:inline-block">
              <span className="brand-text">{copy.highlight}</span>
              <span
                aria-hidden
                className="landing-underline brand-bg absolute -bottom-1 left-0 hidden h-1 w-full rounded-full opacity-80 sm:block"
              />
            </span>{" "}
            {copy.rest}
          </h1>

          <p
            className="landing-rise mx-auto mt-6 max-w-2xl text-pretty text-base leading-7 text-slate-600 sm:text-lg sm:leading-8 dark:text-slate-300"
            style={delay(140)}
          >
            {copy.description}
          </p>

          {signedIn ? (
            <div
              className="landing-rise mt-9 flex w-full max-w-xl justify-center"
              style={delay(220)}
            >
              <LibrarySearch />
            </div>
          ) : null}

          <div
            className="landing-rise mt-8 flex w-full flex-col items-stretch justify-center gap-3 sm:w-auto sm:flex-row sm:items-center"
            style={delay(signedIn ? 300 : 220)}
          >
            {copy.ctas.map((cta) => (
              <HeroCta key={cta.href} cta={cta} />
            ))}
          </div>

          {/* Access requests keep a single write path: the student dashboard
              owns the form, so the landing page only points at it. No extra LMS
              lookup and no second submit surface. */}
          {student ? (
            // The whole card is one link: bigger tap target, and it reuses the
            // cards' masked hover ring. Still a pointer only, never a form.
            <div
              className="landing-rise mx-auto mt-8 w-full max-w-xl"
              style={delay(380)}
            >
              <Link
                aria-label="Help & access: AI Agent course, n8n access, password reset or OpenAI access"
                className={`landing-card group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left transition-[translate,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-white motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-900 ${focusRing}`}
                href="/dashboard/issues"
              >
                <span
                  aria-hidden
                  className="brand-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm transition-transform duration-200 ease-out group-hover:scale-110 group-hover:-rotate-6 motion-reduce:transition-none motion-reduce:group-hover:scale-100 motion-reduce:group-hover:rotate-0"
                >
                  <SparklesIcon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                    AI Agent course
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-600 dark:text-slate-400">
                    Need n8n access, password reset or OpenAI access?
                  </span>
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                  <span className="hidden sm:inline">Help &amp; access</span>
                  <ArrowRightIcon
                    size={14}
                    className="transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                  />
                </span>
              </Link>
            </div>
          ) : null}
        </div>

        <ul
          aria-label="Support highlights"
          className="mx-auto mt-16 grid w-full max-w-5xl gap-4 sm:grid-cols-3 sm:gap-5"
          role="list"
        >
          {copy.cards.map((card, index) => {
            const Icon = card.icon;
            const content = (
              <>
                <span className={cardIconClass}>
                  <Icon size={20} />
                </span>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {card.title}
                </h2>
                <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-400">
                  {card.body}
                </p>
                {card.cta ? (
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-4 text-xs font-semibold text-cyan-700 dark:text-cyan-300">
                    {card.cta}
                    <ArrowRightIcon
                      size={14}
                      className="transition-transform duration-200 ease-out group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                    />
                  </span>
                ) : null}
              </>
            );

            return (
              <li
                key={card.title}
                className="landing-card-reveal"
                style={{ "--landing-card-i": index } as CSSProperties}
              >
                {card.href ? (
                  <Link className={cardLinkClass} href={card.href}>
                    {content}
                  </Link>
                ) : (
                  <div className={cardBaseClass}>{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
