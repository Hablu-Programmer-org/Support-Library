import type { FC } from "react";

import type { IconSvgProps } from "@/components/icons";
import {
  BookIcon,
  CaseIcon,
  DashboardIcon,
  FileTextIcon,
  SparklesIcon,
  UserIcon,
  VideoIcon,
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
    label: "Submit issue",
    href: "/dashboard/issues/new",
    exact: true,
    maxRole: "STUDENT",
    icon: SparklesIcon,
  },
  // Students reach live support from their own request, so the way back is the
  // list of requests rather than a separate room page.
  {
    label: "My requests",
    href: "/dashboard/my-requests",
    maxRole: "STUDENT",
    icon: FileTextIcon,
  },
  myCoursesItem(),
  // Staff only: students join from a specific request.
  {
    label: "Live support",
    href: "/dashboard/support",
    minRole: "MENTOR",
    icon: VideoIcon,
  },
  // Staff-only: the students waiting in the room, with the request each one
  // brought. Students never see this item (and the page double-guards it).
  {
    label: "Support queue",
    href: "/dashboard/live-support",
    minRole: "MENTOR",
    icon: UserIcon,
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

export function navItemsForRole(role?: UserRole): NavItem[] {
  if (!role) return NAV_ITEMS.filter((item) => !item.minRole && !item.maxRole);
  return NAV_ITEMS.filter((item) => withinRole(role, item));
}
