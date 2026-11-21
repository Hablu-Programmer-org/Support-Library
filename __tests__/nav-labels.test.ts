import { describe, expect, it } from "vitest";

import { navItemsForRole } from "@/lib/config/nav";

// External items (My Courses) depend on the LMS origin env, so only the
// in-app links are pinned here.
const internal = (role: Parameters<typeof navItemsForRole>[0]) =>
  navItemsForRole(role)
    .filter((item) => !item.external)
    .map((item) => [item.label, item.href]);

describe("nav labels", () => {
  it("student sees one word for their own cases: issue", () => {
    expect(internal("STUDENT")).toEqual([
      ["Issues", "/dashboard/issues"],
      ["Create issue", "/dashboard/issues/new"],
      ["My issues", "/dashboard/my-issues"],
    ]);
    expect(
      navItemsForRole("STUDENT").some((item) => /request/i.test(item.label)),
    ).toBe(false);
  });

  it.each(["MENTOR", "ADMIN"] as const)("%s never gets the student-only items", (role) => {
    const hrefs = navItemsForRole(role).map((item) => item.href);
    expect(hrefs).not.toContain("/dashboard/my-issues");
    expect(hrefs).not.toContain("/dashboard/issues/new");
    expect(hrefs).toContain("/dashboard/issues");
  });
});
