"use client";

import { cn } from "@heroui/theme";
import Image from "next/image";
import { useEffect } from "react";

import { SidebarItem } from "@/components/layout/sidebar-item";
import type { ShellUser } from "@/components/layout/shell";
import type { NavItem } from "@/lib/config/nav";
import { ROLE_LABELS } from "@/lib/roles";

type SidebarProps = {
  items: NavItem[];
  /** Desktop rail: expanded (w-80) or collapsed (w-[70px]). */
  open: boolean;
  /** Mobile: off-canvas drawer visibility. */
  mobileOpen: boolean;
  user: ShellUser;
  onCloseMobile: () => void;
};

export function Sidebar({ items, open, mobileOpen, user, onCloseMobile }: SidebarProps) {
  const expanded = open || mobileOpen;

  // Close the drawer with Escape while it is open.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseMobile();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {mobileOpen && (
        <div
          aria-hidden
          className="fixed inset-0 top-16 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={onCloseMobile}
        />
      )}

      <aside
        aria-label="সাইডবার"
        className={cn(
          "fixed bottom-0 left-0 top-16 z-50 flex flex-col border-r border-slate-800 bg-slate-950/80 backdrop-blur-sm transition-all duration-300",
          // Mobile drawer: off-canvas unless mobileOpen. Desktop: always on-canvas.
          mobileOpen ? "w-80 translate-x-0" : "w-80 -translate-x-full md:translate-x-0",
          open ? "md:w-80" : "md:w-[70px]",
        )}
      >
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4">
          <nav className="space-y-1">
            {items.map((item) => (
              <SidebarItem
                key={item.href}
                expanded={expanded}
                item={item}
                onNavigate={onCloseMobile}
              />
            ))}
          </nav>
        </div>

        <div
          className={cn(
            "flex items-center gap-3 border-t border-slate-800 px-4 py-4",
            !expanded && "justify-center px-2.5",
          )}
        >
          <Image
            alt=""
            className="shrink-0 rounded-full"
            height={28}
            src={user.image || "/avatar/avatar.png"}
            width={28}
          />
          {expanded && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">
                {user.name ?? "বেনামী"}
              </p>
              <p className="truncate text-xs text-slate-400">
                {user.role ? ROLE_LABELS[user.role] : "ভিউয়ার"}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
