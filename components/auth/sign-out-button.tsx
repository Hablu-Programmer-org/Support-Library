"use client";

import { signOut } from "next-auth/react";
import { LogOutIcon } from "@/components/icons";

export function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-danger-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-danger-400"
      type="button"
      aria-label="Sign out"
    >
      <LogOutIcon size={20} />
    </button>
  );
}
