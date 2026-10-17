"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

import { SignOutButton } from "@/components/auth/sign-out-button";
import { CloseIcon, MenuIcon } from "@/components/icons";
import type { ShellUser } from "@/components/layout/shell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { ROLE_LABELS } from "@/lib/roles";

type AccountSheetProps = {
  user: ShellUser;
};

/**
 * Mobile-only account menu. It intentionally contains NO navigation links so it
 * stays outside `header nav[aria-label="Primary"]` (whose link count is part of
 * the shell E2E contract); it only surfaces identity, appearance and sign-out.
 */
export function AccountSheet({ user }: AccountSheetProps) {
  const [open, setOpen] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const initials = (user.name ?? user.email ?? "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const roleLabel = user.role ? ROLE_LABELS[user.role] : ROLE_LABELS.STUDENT;

  const panelMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { x: "100%" },
        animate: { x: 0 },
        exit: { x: "100%" },
      };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Account menu"
        aria-expanded={open}
        aria-controls="account-sheet"
        className="rounded-full p-2 text-slate-700 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-cyan-500 sm:hidden dark:text-white dark:hover:bg-slate-800"
      >
        <MenuIcon size={20} />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            className="fixed inset-0 z-60 sm:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
          >
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="absolute inset-0 h-full w-full cursor-default bg-slate-950/50 backdrop-blur-sm"
            />

            <motion.div
              id="account-sheet"
              role="dialog"
              aria-modal="true"
              aria-label="Account menu"
              initial={panelMotion.initial}
              animate={panelMotion.animate}
              exit={panelMotion.exit}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { type: "spring", stiffness: 340, damping: 34 }
              }
              className="glass absolute right-0 top-0 flex h-full w-[85%] max-w-xs flex-col gap-4 rounded-l-3xl p-5"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="brand-bg flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl shadow-sm ring-1 ring-white/25 dark:ring-white/20">
                    <Image
                      alt=""
                      className="h-7 w-auto"
                      height={339}
                      src="/logo.png"
                      width={499}
                    />
                  </span>
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    Account
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <CloseIcon size={18} />
                </button>
              </div>

              <div className="brand-ring flex items-center gap-3 rounded-2xl border border-white/60 bg-white/60 p-3 dark:border-white/10 dark:bg-slate-900/50">
                <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-sm font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
                  {user.image ? (
                    <Image alt="" fill sizes="44px" src={user.image} />
                  ) : (
                    initials
                  )}
                </span>
                <span className="flex min-w-0 flex-col leading-tight">
                  <span className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                    {user.name ?? "Unnamed user"}
                  </span>
                  <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {user.email}
                  </span>
                  <span className="mt-1 w-fit rounded-full bg-primary-500/10 px-2 py-0.5 text-xs font-medium text-cyan-700 ring-1 ring-cyan-500/20 dark:bg-primary-500/15 dark:text-cyan-300">
                    {roleLabel}
                  </span>
                </span>
              </div>

              <div className="mt-auto flex flex-col gap-3">
                <div className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/60 px-4 py-3 dark:border-white/10 dark:bg-slate-900/50">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Appearance
                  </span>
                  <ThemeToggle />
                </div>
                <SignOutButton withLabel />
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
