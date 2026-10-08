import type { FC } from "react";

import type { IconSvgProps } from "@/components/icons";
import { CaseIcon, DashboardIcon, SolutionIcon } from "@/components/icons";
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

export const NAV_ITEMS: NavItem[] = [
  { label: "ড্যাশবোর্ড", href: "/dashboard", exact: true, icon: DashboardIcon },
  { label: "কেস", href: "/dashboard/cases", icon: CaseIcon },
  { label: "সলিউশন", href: "/dashboard/solutions", icon: SolutionIcon },
];

export function navItemsForRole(role?: UserRole): NavItem[] {
  if (!role) return NAV_ITEMS.filter((item) => !item.minRole);
  return NAV_ITEMS.filter((item) => !item.minRole || ROLE_RANK[role] >= ROLE_RANK[item.minRole]);
}