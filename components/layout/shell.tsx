"use client";

import type { ReactNode } from "react";

import { Topbar } from "@/components/layout/topbar";
import type { UserRole } from "@/lib/roles";

export type ShellUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role?: UserRole;
};

type DashboardShellProps = {
  user: ShellUser;
  children: ReactNode;
};

/**
 * Dashboard chrome: fixed topbar with inline navigation plus content offset
 * below it. The nav items carry icon components, so this stays a client shell
 * to keep the server component boundary at the layout.
 */
export function DashboardShell({ user, children }: DashboardShellProps) {
  return (
    <div className="min-h-screen">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="aurora-blob absolute -left-24 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-cyan-500/20 to-violet-500/20 blur-3xl" />
        <div
          className="aurora-blob absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-gradient-to-tr from-violet-500/15 to-cyan-500/15 blur-3xl"
          style={{ animationDelay: "-6s" }}
        />
      </div>
      <Topbar user={user} />
      <main className="min-h-screen p-4 pt-20">{children}</main>
    </div>
  );
}