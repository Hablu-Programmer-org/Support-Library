"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";
import type { NavItem } from "@/lib/config/nav";

type SidebarItemProps = {
  item: NavItem;
  /** Labels show only when the sidebar is expanded (desktop) or open (mobile drawer). */
  expanded: boolean;
  /** Closes the mobile drawer after navigating. */
  onNavigate?: () => void;
};

export function SidebarItem({ item, expanded, onNavigate }: SidebarItemProps) {
  const pathname = usePathname();
  const Icon = item.icon;
  const active = item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);

  return (
    <Link
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex cursor-pointer items-center gap-4 rounded-md p-3 text-slate-700 transition-colors hover:bg-slate-200 active:scale-95 dark:text-white dark:hover:bg-slate-600/30",
        active && "bg-slate-200 dark:bg-slate-500/30",
        expanded ? "justify-start" : "w-full justify-center",
      )}
      href={item.href}
      onClick={onNavigate}
      title={expanded ? undefined : item.label}
    >
      <span className={cn("flex shrink-0 items-center justify-center", active && "text-cyan-500")}>
        <Icon size={22} />
      </span>
      {expanded && (
        <span
          className={cn(
            "truncate text-base font-medium",
            active && "font-semibold text-cyan-500",
          )}
        >
          {item.label}
        </span>
      )}
    </Link>
  );
}
