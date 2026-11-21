"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { UserMenu } from "@/components/auth/user-menu";
import { MenuIcon } from "@/components/icons";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { ShellUser } from "@/components/layout/shell";
import { PageContainer } from "@/components/shared/page-container";
import { navItemsForRole, type NavItem } from "@/lib/config/nav";

// AccountSheet pulls in framer-motion. Splitting it into its own chunk means
// the chunk only loads when it renders (signed-in users), so guests on the
// landing page never download the animation library. SSR stays on, so the
// menu button is in the first HTML and nothing shifts on hydration.
//
// It MUST render inside its own <Suspense>: with `ssr: true` and no `loading`,
// next/dynamic adds no boundary, so a pending chunk would hold back hydration
// of the whole page (the landing search then fell back to a native submit).
const AccountSheet = dynamic(() =>
  import("@/components/layout/account-sheet").then((mod) => mod.AccountSheet),
);

/** Same box as AccountSheet's trigger; decorative only, so no duplicate button. */
function AccountSheetFallback() {
  return (
    <span aria-hidden className="rounded-full p-2 text-slate-700 lg:hidden dark:text-white">
      <MenuIcon size={20} />
    </span>
  );
}

type TopbarProps = {
  user?: ShellUser;
};

const isActive = (pathname: string, item: NavItem) =>
  item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);

/**
 * Href of the single nav item to highlight.
 *
 * A prefix match can overlap a more specific sibling (e.g. `/dashboard/issues`
 * vs `/dashboard/issues/new`), so the longest matching href wins and only one
 * link ever carries `aria-current`.
 */
function activeHrefFor(pathname: string, items: NavItem[]) {
  return items
    .filter((item) => !item.external && isActive(pathname, item))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function Topbar({ user }: TopbarProps) {
  const pathname = usePathname();
  const navItems = user ? navItemsForRole(user.role) : [];
  const activeHref = activeHrefFor(pathname, navItems);

  return (
    <header className="brand-hairline fixed left-0 right-0 top-0 z-50 flex h-16 items-center border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80">
      {/* Decorative brand wash; background-color stays untouched for the shell E2E. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-linear-to-r from-cyan-500/10 via-transparent to-violet-500/10"
      />

      <PageContainer className="relative z-10 flex min-w-0 items-center justify-between gap-2">
        <div className="flex shrink-0 items-center gap-2.5">
          {/* The link carries the name: the wordmark beside the logo is hidden
              below lg, so the image itself stays decorative (alt="") and the
              name is never announced twice. */}
          <Link
            aria-label="Hablu Support Library home"
            className="group flex w-fit items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-cyan-500"
            href="/"
          >
            <span className="brand-bg flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-white/25 transition group-hover:brightness-110 group-hover:ring-white/50 dark:ring-white/20">
              {/* logo.png is 490x348. width/height are the rendered size
                  (28px tall fits the 40px box), so next/image serves a 48/96px
                  file instead of a 1080px one. Above the fold: load eagerly. */}
              <Image
                alt=""
                className="h-7 w-auto object-contain"
                height={28}
                loading="eager"
                src="/logo.png"
                width={39}
              />
            </span>
            <span className="hidden text-lg font-semibold lg:block lg:text-xl">
              <span className="text-slate-900 dark:text-white">Hablu</span>{" "}
              <span className="brand-text">Support Library</span>
            </span>
          </Link>
        </div>

        <nav
          aria-label="Primary"
          className="flex min-w-0 flex-1 items-center justify-center gap-0.5 overflow-x-auto sm:gap-1"
        >
          {navItems.map((item) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            const className = `group relative flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 motion-reduce:transition-none ${
              active
                ? "bg-cyan-500/10 font-semibold text-cyan-700 ring-1 ring-inset ring-cyan-500/25 dark:bg-cyan-400/10 dark:text-cyan-300 dark:ring-cyan-400/25"
                : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
            }`;
            // Labels stay hidden until `lg`: below that the four items a
            // student sees (Issues, Submit issue, My Courses, Live support)
            // plus the brand and account controls do not fit on one row.
            // `aria-label` keeps the accessible name — and the E2E lookups —
            // identical at every width.
            const content = (
              <>
                <Icon
                  size={18}
                  className={
                    active
                      ? "text-cyan-500"
                      : "text-slate-400 transition group-hover:text-slate-500 dark:group-hover:text-slate-300"
                  }
                />
                <span className="hidden xl:inline">{item.label}</span>
              </>
            );

            return item.external ? (
              <a
                key={item.href}
                aria-label={item.label}
                className={className}
                href={item.href}
                rel="noopener noreferrer"
                target="_blank"
              >
                {content}
              </a>
            ) : (
              <Link
                key={item.href}
                aria-current={active ? "page" : undefined}
                aria-label={item.label}
                className={className}
                href={item.href}
              >
                {content}
              </Link>
            );
          })}
        </nav>

        {/* The bar follows the active theme, so ThemeToggle/UserMenu inherit it. */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          {user ? (
            <>
              <div className="hidden items-center gap-2 lg:flex">
                <ThemeToggle />
                <UserMenu user={user} />
                <SignOutButton />
              </div>
              <Suspense fallback={<AccountSheetFallback />}>
                <AccountSheet user={user} />
              </Suspense>
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link
                href="/login"
                // Dark text: white on cyan-500 fails WCAG AA (2.42:1).
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-primary-600"
              >
                Sign in
              </Link>
            </>
          )}
        </div>
      </PageContainer>
    </header>
  );
}
