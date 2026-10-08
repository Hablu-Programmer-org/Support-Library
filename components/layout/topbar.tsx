"use client";

import Image from "next/image";
import Link from "next/link";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { UserMenu } from "@/components/auth/user-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { ShellUser } from "@/components/layout/shell";

type TopbarProps = {
  user: ShellUser;
  /** Desktop rail state (drives the rotate on the collapse icon). */
  open: boolean;
  /** Mobile drawer state (drives aria-expanded). */
  mobileOpen: boolean;
  onToggle: () => void;
};

export function Topbar({ user, open, mobileOpen, onToggle }: TopbarProps) {
  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-16 items-center border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex w-full items-center justify-between px-4">
        <div className="flex min-w-fit items-center gap-2.5">
          <button
            aria-expanded={open || mobileOpen}
            aria-label="সাইডবার টগল"
            className="-ml-1 rounded-full text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-500 dark:text-white"
            type="button"
            onClick={onToggle}
          >
            {/* Mobile: hamburger opens the off-canvas drawer. */}
            <svg
              aria-hidden
              className="h-6 w-6 md:hidden"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                d="M4 6h16M4 12h16M4 18h16"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
              />
            </svg>
            {/* Desktop: collapse/expand the rail. */}
            <Image
              alt=""
              className={`hidden transition-transform md:block ${open ? "rotate-180" : ""}`}
              height={28}
              src="/icons/open-sidebar.png"
              width={28}
            />
          </button>

          <Link className="flex w-fit items-center gap-2.5" href="/dashboard">
            <Image alt="Hablu Support Library" height={40} src="/logo.png" width={40} />
            <span className="hidden text-lg font-semibold text-slate-900 sm:block lg:text-xl dark:text-white">
              Hablu Support Library
            </span>
          </Link>
        </div>

        {/* The bar follows the active theme, so ThemeToggle/UserMenu inherit it. */}
        <div className="flex items-center gap-2 sm:gap-4">
          <ThemeToggle />
          <UserMenu user={user} />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
