"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { navItemsForRole } from "@/lib/config/nav";
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
 * Dashboard chrome: fixed dark topbar + sidebar (collapse rail on desktop,
 * off-canvas drawer on mobile) with content offset below/right of them.
 *
 * State lives here because the topbar toggle drives both breakpoints:
 * below md it opens the drawer, at md+ it expands the rail.
 */
export function DashboardShell({ user, children }: DashboardShellProps) {
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Navigate → close the mobile drawer so it never covers the new page.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const handleToggle = () => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (isMobile) {
      setMobileOpen((value) => !value);
    } else {
      setOpen((value) => !value);
    }
  };

  return (
    <div className="min-h-screen">
      <Topbar
        mobileOpen={mobileOpen}
        open={open}
        user={user}
        onToggle={handleToggle}
      />
      <Sidebar
        items={navItemsForRole(user.role)}
        mobileOpen={mobileOpen}
        open={open}
        user={user}
        onCloseMobile={() => setMobileOpen(false)}
      />
      <main className="min-h-screen p-4 pt-20 md:ps-20">{children}</main>
    </div>
  );
}
