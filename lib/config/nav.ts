import type { FC } from "react";

import type { IconSvgProps } from "@/components/icons";
import {
  BookIcon,
  CaseIcon,
  DashboardIcon,
  FileTextIcon,
  SparklesIcon,
  VideoIcon,
  HelpCircleIcon,
} from "@/components/icons";
import { lmsHref } from "@/lib/links";
import { ROLE_RANK, type UserRole } from "@/lib/roles";

export type NavItem = {
  label: string;
  href: string;
  /** True for index routes that must not match child paths. */
  exact?: boolean;
  /** True when `href` leaves this app, so it never carries the active state. */
  external?: boolean;
  /** Only shows when the current user's role satisfies `minRole`. */
  minRole?: UserRole;
  /** Only shows when the current user's role does not exceed `maxRole`. */
  maxRole?: UserRole;
  icon: FC<IconSvgProps>;
};

const myCoursesItem = (): NavItem | null => {
  const href = lmsHref("/dashboard/my-courses");
  // Without an LMS origin the link would resolve against this app and 404, so
  // the item is omitted entirely instead of being rendered broken.
  if (!href) return null;

  return {
    label: "My Courses",
    href,
    external: true,
    maxRole: "STUDENT",
    icon: BookIcon,
  };
};

const ROLE_NAV_ITEMS: Array<NavItem | null> = [
  { label: "Dashboard", href: "/dashboard", exact: true, minRole: "MENTOR", icon: DashboardIcon },
  { label: "Issues", href: "/dashboard/issues", icon: CaseIcon },
  {
    label: "Create issue",
    href: "/dashboard/issues/new",
    exact: true,
    maxRole: "STUDENT",
    icon: SparklesIcon,
  },
  // Students reach live support from their own request, so the way back is the
  // list of their issues rather than a separate room page.
  {
    label: "My issues",
    href: "/dashboard/my-issues",
    maxRole: "STUDENT",
    icon: FileTextIcon,
  },
  myCoursesItem(),
  { label: "Access requests", href: "/dashboard/access-requests", minRole: "ADMIN", icon: HelpCircleIcon },
  // Staff only: the room to join plus today's waiting students (students join
  // from a specific request, and the page double-guards it).
  {
    label: "Live support",
    href: "/dashboard/live-support",
    minRole: "MENTOR",
    icon: VideoIcon,
  },
];

export const NAV_ITEMS: NavItem[] = ROLE_NAV_ITEMS.filter(
  (item): item is NavItem => item !== null,
);

function withinRole(userRole: UserRole, item: NavItem) {
  if (item.minRole && ROLE_RANK[userRole] < ROLE_RANK[item.minRole]) return false;
  if (item.maxRole && ROLE_RANK[userRole] > ROLE_RANK[item.maxRole]) return false;
  return true;
}

const isActive = (pathname: string, item: NavItem) =>
  item.exact
    ? pathname === item.href
    : pathname === item.href || pathname.startsWith(`${item.href}/`);

/**
 * Href of the single nav item to highlight, shared by the topbar and the
 * mobile menu.
 *
 * A prefix match can overlap a more specific sibling (e.g. `/dashboard/issues`
 * vs `/dashboard/issues/new`), so the longest matching href wins and only one
 * link ever carries `aria-current`. External items never match.
 */
export function activeHrefFor(pathname: string, items: NavItem[]) {
  return items
    .filter((item) => !item.external && isActive(pathname, item))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function navItemsForRole(role?: UserRole): NavItem[] {
  if (!role) return NAV_ITEMS.filter((item) => !item.minRole && !item.maxRole);
  return NAV_ITEMS.filter((item) => withinRole(role, item));
}
