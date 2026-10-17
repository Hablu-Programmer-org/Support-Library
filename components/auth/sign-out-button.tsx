"use client";

import { signOut } from "next-auth/react";
import { LogOutIcon } from "@/components/icons";

type SignOutButtonProps = {
  /** Renders a labelled, full-width action (used by the mobile account sheet). */
  withLabel?: boolean;
  className?: string;
};

export function SignOutButton({ withLabel = false, className = "" }: SignOutButtonProps) {
  const base = withLabel
    ? "inline-flex w-full items-center justify-center gap-2 rounded-lg border border-danger-200/70 bg-danger-50 px-4 py-2.5 text-sm font-semibold text-danger-700 transition hover:bg-danger-100 dark:border-danger-900/40 dark:bg-danger-950/40 dark:text-danger-200 dark:hover:bg-danger-950/60"
    : "rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-danger-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-danger-400";

  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={`${base} ${className}`}
      type="button"
      aria-label="Sign out"
    >
      <LogOutIcon size={withLabel ? 18 : 20} />
      {withLabel ? <span>Sign out</span> : null}
    </button>
  );
}
