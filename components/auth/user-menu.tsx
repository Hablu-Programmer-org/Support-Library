"use client";

import { signOut } from "next-auth/react";
import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

import { LogOutIcon } from "@/components/icons";
import { navStyles } from "@/components/layout/nav-styles";
import { cn } from "@/lib/cn";
import { ROLE_LABELS, type UserRole } from "@/lib/roles";

interface UserMenuProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role?: UserRole;
  };
}

export function initialsFor(user: {
  name?: string | null;
  email?: string | null;
}) {
  return (user.name ?? user.email ?? "U")
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Profile avatar menu in the LMS v2 style (avatar ring → identity, role,
 * sign out). Shown at every width; navigation lives in the topbar (lg+) and
 * the mobile menu.
 *
 * Its accessible name must differ from the mobile menu's, and it must not
 * contain the mobile menu's panel id: the landing E2E finds that lazy chunk by
 * it, and this file ships in the main chunk (see __tests__/user-menu.test.tsx).
 */
export function UserMenu({ user }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const roleLabel = user.role ? ROLE_LABELS[user.role] : ROLE_LABELS.STUDENT;
  const initials = initialsFor(user);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const avatar = (size: number, text: string) => (
    <span
      className={cn(
        "brand-bg relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white",
        text,
      )}
      style={{ width: size, height: size }}
    >
      {user.image ? <Image alt="" fill sizes={`${size}px`} src={user.image} className="object-cover" /> : initials}
    </span>
  );

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label="Profile menu"
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          "flex rounded-full ring-2 transition-shadow duration-150 motion-reduce:transition-none",
          navStyles.focus,
          open
            ? "ring-cyan-400/70"
            : "ring-slate-200 hover:ring-cyan-400/70 dark:ring-slate-700 dark:hover:ring-cyan-400/70",
        )}
      >
        {avatar(36, "text-xs")}
      </button>

      {open ? (
        <div
          id={panelId}
          className={cn(
            "absolute right-0 top-[calc(100%+0.75rem)] w-64 max-w-[calc(100vw-2rem)] rounded-xl p-1",
            navStyles.popover,
          )}
        >
          <div className="flex items-center gap-3 rounded-lg px-3 py-2.5">
            {avatar(40, "text-sm")}
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                {user.name ?? "Unnamed user"}
              </span>
              <span className={cn("truncate text-xs", navStyles.textMuted)}>{user.email}</span>
              <span className="mt-1.5 w-fit rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-300">
                {roleLabel}
              </span>
            </span>
          </div>
          <div className={cn("my-1 border-t", navStyles.divider)} />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-danger-600 transition-colors hover:bg-danger-500/10 dark:text-danger-500",
              navStyles.focus,
            )}
          >
            <LogOutIcon size={16} />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
