"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-xl bg-danger-100 px-3 py-2 text-sm font-semibold text-danger-700 transition hover:bg-danger-200 dark:bg-danger-950/50 dark:text-danger-200 dark:hover:bg-danger-900/60"
      type="button"
    >
      Sign Out
    </button>
  );
}
