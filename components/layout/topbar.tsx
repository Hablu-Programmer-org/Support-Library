"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

import { UserMenu } from "@/components/auth/user-menu";
import { ExternalLinkIcon, MenuIcon } from "@/components/icons";
import { navStyles } from "@/components/layout/nav-styles";
import type { ShellUser } from "@/components/layout/shell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { PageContainer } from "@/components/shared/page-container";
import { cn } from "@/lib/cn";
import { activeHrefFor, navItemsForRole } from "@/lib/config/nav";

// MobileMenu pulls in framer-motion. Splitting it into its own chunk means the
// chunk only loads when it renders (signed-in users), so guests on the landing
// page never download the animation library. SSR stays on, so the menu button
// is in the first HTML and nothing shifts on hydration.
//
// It MUST render inside its own <Suspense>: with `ssr: true` and no `loading`,
// next/dynamic adds no boundary, so a pending chunk would hold back hydration
// of the whole page (the landing search then fell back to a native submit).
const MobileMenu = dynamic(() =>
  import("@/components/layout/mobile-menu").then((mod) => mod.MobileMenu),
);

/** Same box as MobileMenu's trigger; decorative only, so no duplicate button. */
function MobileMenuFallback() {
  return (
    <span aria-hidden className={cn(navStyles.iconButton, "lg:hidden")}>
      <MenuIcon size={22} />
    </span>
  );
}

type TopbarProps = {
  user?: ShellUser;
};

/**
 * Site header in the LMS v2 navbar style: brand lockup, text links with a cyan
 * underline on the active one (lg+), the profile avatar, and a hamburger menu
 * below lg. Guests get only the brand, theme toggle and Sign in.
 */
export function Topbar({ user }: TopbarProps) {
  const pathname = usePathname();
  const navItems = user ? navItemsForRole(user.role) : [];
  const activeHref = activeHrefFor(pathname, navItems);

  return (
    <header className={cn("fixed left-0 right-0 top-0 z-50 flex h-16 items-center", navStyles.header)}>
      <PageContainer className="flex min-w-0 items-center justify-between gap-4">
        {/* The link carries the name; the logo is decorative and the visible
            text is aria-hidden, so the name is announced once. */}
        <Link
          aria-label="Hablu Support Library home"
          className={cn("flex min-w-0 shrink-0 items-center gap-2.5 rounded-lg", navStyles.focus)}
          href="/"
        >
          {/* logo.png is 490x348; 32px tall renders 45px wide. Above the fold:
              load eagerly. */}
          <Image
            alt=""
            className="h-8 w-auto object-contain"
            height={32}
            loading="eager"
            src="/logo.png"
            width={45}
          />
          <span
            aria-hidden
            className={cn("truncate text-base font-semibold tracking-tight lg:text-lg", navStyles.brandText)}
          >
            <span className="hidden sm:inline">Hablu </span>Support Library
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 lg:gap-6">
          {navItems.length > 0 ? (
            <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
              {navItems.map((item) => {
                const active = item.href === activeHref;
                const className = cn(
                  navStyles.link,
                  navStyles.focus,
                  "rounded-sm",
                  active ? cn(navStyles.linkActive, navStyles.underline) : navStyles.linkIdle,
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
                    {item.label}
                    <ExternalLinkIcon className="opacity-60" />
                  </a>
                ) : (
                  <Link
                    key={item.href}
                    aria-current={active ? "page" : undefined}
                    aria-label={item.label}
                    className={className}
                    href={item.href}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ) : (
            // Guests: keep the landmark (the landing E2E asserts it has no links).
            <nav aria-label="Primary" />
          )}

          {/* The bar follows the active theme, so ThemeToggle/UserMenu inherit it. */}
          {user ? (
            <div className="flex items-center gap-2">
              <div className="hidden lg:block">
                <ThemeToggle />
              </div>
              <UserMenu user={user} />
              <Suspense fallback={<MobileMenuFallback />}>
                <MobileMenu items={navItems} />
              </Suspense>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link
                href="/login"
                // Dark text: white on cyan-500 fails WCAG AA (2.42:1).
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-primary-600"
              >
                Sign in
              </Link>
            </div>
          )}
        </div>
      </PageContainer>
    </header>
  );
}
