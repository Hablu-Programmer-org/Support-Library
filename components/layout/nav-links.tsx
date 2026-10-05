"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/models";
import { Button, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";

type NavLink = {
  label: string;
  href: string;
  /** True when the route is the dashboard index, which has no children. */
  exact?: boolean;
};

const LINKS: NavLink[] = [
  { label: "ড্যাশবোর্ড", href: "/dashboard", exact: true },
  { label: "স্টুডেন্ট", href: "/dashboard/students" },
  { label: "কেস", href: "/dashboard/cases" },
  { label: "সলিউশন", href: "/dashboard/solutions" },
  { label: "সার্চ", href: "/dashboard/search" },
  { label: "অ্যানালিটিক্স", href: "/dashboard/analytics" },
];

function isActive(link: NavLink, pathname: string) {
  if (link.exact) return pathname === link.href;
  return pathname === link.href || pathname.startsWith(`${link.href}/`);
}

export function NavLinks({ role }: { role: UserRole | undefined }) {
  const pathname = usePathname();

  const links = role === "ADMIN"
    ? [...LINKS, { label: "অ্যাডমিন", href: "/dashboard/admin" }]
    : LINKS;

  return (
    <>
      {/* Desktop: horizontal nav. `hidden md:flex` collapses it below
          the md breakpoint so the mobile menu takes over. */}
      <nav className="hidden items-center gap-4 text-sm md:flex" aria-label="মূল নেভিগেশন">
        {links.map((link) => {
          const active = isActive(link, pathname);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "font-medium text-primary-600 dark:text-primary-400"
                  : "text-gray-600 dark:text-gray-300 hover:text-primary-600"
              }
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      {/* Mobile: hamburger + dropdown. `md:hidden` hides it once the
          horizontal nav is wide enough to show. */}
      <Dropdown>
        <DropdownTrigger>
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            aria-label="মেনু খুলুন"
            aria-expanded={undefined}
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </Button>
        </DropdownTrigger>
        <DropdownMenu aria-label="মূল নেভিগেশন">
          {links.map((link) => (
            <DropdownItem
              key={link.href}
              as={Link}
              href={link.href}
              aria-current={isActive(link, pathname) ? "page" : undefined}
            >
              {link.label}
            </DropdownItem>
          ))}
        </DropdownMenu>
      </Dropdown>
    </>
  );
}