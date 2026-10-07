import type { FC } from "react";

import type { IconSvgProps } from "@/components/icons";
import {
  AdminIcon,
  AnalyticsIcon,
  CaseIcon,
  DashboardIcon,
  SearchIcon,
  SolutionIcon,
  StudentIcon,
} from "@/components/icons";
import type { UserRole } from "@/models";
import { ROLE_RANK } from "@/lib/roles";

export type NavItem = {
  label: string;
  href: string;
  /** True for index routes that must not match child paths. */
  exact?: boolean;
  /** Only shows when the viewer's role satisfies `minRole`. */
  minRole?: UserRole;
  icon: FC<IconSvgProps>;
};

/**
 * Sidebar destinations. Order here is display order. `minRole` mirrors the
 * old top-nav gate (only ADMIN saw the admin link) — see former nav-links.tsx.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "ড্যাশবোর্ড", href: "/dashboard", exact: true, icon: DashboardIcon },
  { label: "স্টুডেন্ট", href: "/dashboard/students", icon: StudentIcon },
  { label: "কেস", href: "/dashboard/cases", icon: CaseIcon },
  { label: "সলিউশন", href: "/dashboard/solutions", icon: SolutionIcon },
  { label: "সার্চ", href: "/dashboard/search", icon: SearchIcon },
  { label: "অ্যানালিটিক্স", href: "/dashboard/analytics", icon: AnalyticsIcon },
  { label: "অ্যাডমিন", href: "/dashboard/admin", minRole: "ADMIN", icon: AdminIcon },
];

export function navItemsForRole(role?: UserRole): NavItem[] {
  if (!role) return NAV_ITEMS.filter((item) => !item.minRole);
  return NAV_ITEMS.filter((item) => !item.minRole || ROLE_RANK[role] >= ROLE_RANK[item.minRole]);
}
