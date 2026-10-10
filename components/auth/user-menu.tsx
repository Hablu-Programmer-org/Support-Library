"use client";

import Image from "next/image";

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: string;
  };
}

export function UserMenu({ user }: UserMenuProps) {
  const initials = (user.name ?? user.email ?? "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="hidden items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/70 sm:flex">
      <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-900/30 dark:text-primary-200">
        {user.image ? <Image alt="" fill sizes="32px" src={user.image} /> : initials}
      </span>
      <span className="flex max-w-44 flex-col leading-tight">
        <span className="truncate text-sm font-medium text-slate-900 dark:text-white">{user.name ?? "Unnamed user"}</span>
        <span className="truncate text-xs text-slate-500 dark:text-slate-400">{user.email}</span>
      </span>
      <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
        {user.role ?? "VIEWER"}
      </span>
    </div>
  );
}
