import { describe, expect, it } from "vitest";

import { activeHrefFor, type NavItem } from "@/lib/config/nav";

const Icon = () => null;
const items: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", exact: true, icon: Icon },
  { label: "Issues", href: "/dashboard/issues", icon: Icon },
  { label: "Create issue", href: "/dashboard/issues/new", exact: true, icon: Icon },
  { label: "My Courses", href: "https://lms.example.com/dashboard/my-courses", external: true, icon: Icon },
];

describe("activeHrefFor", () => {
  it("matches an exact index route only on itself", () => {
    expect(activeHrefFor("/dashboard", items)).toBe("/dashboard");
    expect(activeHrefFor("/dashboard/unknown", items)).toBeUndefined();
  });

  it("lets the longest match win so only one link is active", () => {
    expect(activeHrefFor("/dashboard/issues/new", items)).toBe("/dashboard/issues/new");
    expect(activeHrefFor("/dashboard/issues/abc123", items)).toBe("/dashboard/issues");
    expect(activeHrefFor("/dashboard/issues", items)).toBe("/dashboard/issues");
  });

  it("does not treat a shared prefix without a slash as a child", () => {
    expect(activeHrefFor("/dashboard/issues-archive", items)).toBeUndefined();
  });

  it("never marks an external item active, even on a matching path", () => {
    const external = items[3];
    expect(activeHrefFor(external.href, items)).toBeUndefined();
    expect(activeHrefFor("/anything", [external])).toBeUndefined();
  });
});
