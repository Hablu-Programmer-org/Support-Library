"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { UserMenu } from "@/components/auth/user-menu";
import { AccountSheet } from "@/components/layout/account-sheet";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { ShellUser } from "@/components/layout/shell";
import { PageContainer } from "@/components/shared/page-container";
import { navItemsForRole, type NavItem } from "@/lib/config/nav";

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

      <PageContainer className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex min-w-fit items-center gap-2.5">
          <Link
            className="group flex w-fit items-center gap-2.5 rounded-full focus-visible:outline focus-visible:outline-cyan-500"
            href="/"
          >
            <span className="brand-bg flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-white/25 transition group-hover:brightness-110 group-hover:ring-white/50 dark:ring-white/20">
              <Image
                alt="Hablu Support Library"
                className="h-8 w-auto"
                height={339}
                src="/logo.png"
                width={499}
              />
            </span>
            <span className="hidden text-lg font-semibold sm:block lg:text-xl">
              <span className="text-slate-900 dark:text-white">Hablu</span>{" "}
              <span className="brand-text">Support Library</span>
            </span>
          </Link>
        </div>

        <nav
          aria-label="Primary"
          className="flex flex-1 items-center justify-center gap-1 sm:gap-1.5"
        >
          {navItems.map((item) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            const className = `group relative flex items-center gap-2 rounded-full px-2.5 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-cyan-500 ${
              active
                ? "bg-primary-500/10 text-cyan-700 ring-1 ring-cyan-500/25 dark:bg-primary-500/15 dark:text-cyan-300"
                : "text-slate-700 hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800/70"
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
                <span className="hidden lg:inline">{item.label}</span>
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
        <div className="flex items-center gap-2 sm:gap-4">
          {user ? (
            <>
              <div className="hidden items-center gap-2 sm:flex">
                <ThemeToggle />
                <UserMenu user={user} />
                <SignOutButton />
              </div>
              <AccountSheet user={user} />
            </>
          ) : (
            <>
              <ThemeToggle />
              <Link
                href="/login"
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
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
