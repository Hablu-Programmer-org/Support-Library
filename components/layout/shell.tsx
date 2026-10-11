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
      <Topbar user={user} />
      <main className="min-h-screen p-4 pt-20">{children}</main>
    </div>
  );
}