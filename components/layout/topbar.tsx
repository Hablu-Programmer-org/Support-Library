"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { UserMenu } from "@/components/auth/user-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { ShellUser } from "@/components/layout/shell";
import { navItemsForRole, type NavItem } from "@/lib/config/nav";

type TopbarProps = {
  user?: ShellUser;
};

const isActive = (pathname: string, item: NavItem) =>
  item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);

export function Topbar({ user }: TopbarProps) {
  const pathname = usePathname();
  const navItems = user ? navItemsForRole(user.role) : [];

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex w-full items-center justify-between px-4">
        <div className="flex min-w-fit items-center gap-2.5">
          <Link className="flex w-fit items-center gap-2.5" href="/dashboard">
            <Image
              alt="Hablu Support Library"
              className="h-10 w-auto"
              height={339}
              src="/logo.png"
              width={499}
            />
            <span className="hidden text-lg font-semibold text-slate-900 sm:block lg:text-xl dark:text-white">
              Hablu Support Library
            </span>
          </Link>
        </div>

        <nav aria-label="Primary" className="flex flex-1 items-center justify-center gap-1 sm:gap-2">
          {navItems.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-lg px-2.5 py-1.5 text-sm font-medium transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 dark:hover:bg-slate-800 ${
                  active
                    ? "text-cyan-600 dark:text-cyan-400"
                    : "text-slate-700 dark:text-slate-200"
                }`}
                href={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* The bar follows the active theme, so ThemeToggle/UserMenu inherit it. */}
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          {user ? (
            <>
              <UserMenu user={user} />
              <SignOutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}