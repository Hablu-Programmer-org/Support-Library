import type { FC } from "react";

import type { IconSvgProps } from "@/components/icons";
import { CaseIcon, DashboardIcon, SparklesIcon } from "@/components/icons";
import { ROLE_RANK, type UserRole } from "@/lib/roles";

export type NavItem = {
  label: string;
  href: string;
  /** True for index routes that must not match child paths. */
  exact?: boolean;
  /** Only shows when the current user's role satisfies `minRole`. */
  minRole?: UserRole;
  /** Only shows when the current user's role does not exceed `maxRole`. */
  maxRole?: UserRole;
  icon: FC<IconSvgProps>;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", exact: true, minRole: "MENTOR", icon: DashboardIcon },
  { label: "Issues", href: "/dashboard/issues", icon: CaseIcon },
  {
    label: "Submit issue",
    href: "/dashboard/issues/new",
    exact: true,
    maxRole: "STUDENT",
    icon: SparklesIcon,
  },
];

function withinRole(userRole: UserRole, item: NavItem) {
  if (item.minRole && ROLE_RANK[userRole] < ROLE_RANK[item.minRole]) return false;
  if (item.maxRole && ROLE_RANK[userRole] > ROLE_RANK[item.maxRole]) return false;
  return true;
}

export function navItemsForRole(role?: UserRole): NavItem[] {
  if (!role) return NAV_ITEMS.filter((item) => !item.minRole && !item.maxRole);
  return NAV_ITEMS.filter((item) => withinRole(role, item));
}
