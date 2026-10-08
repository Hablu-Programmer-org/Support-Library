import { describe, expect, it } from "vitest";

import { mapLmsRole } from "@/lib/lms-roles";

describe("mapLmsRole", () => {
  it("maps senior/staff roles to ADMIN", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "MANAGER", "COORDINATOR", "MODERATOR"]) {
      expect(mapLmsRole(role)).toBe("ADMIN");
    }
  });

  it("maps teaching roles to MENTOR", () => {
    for (const role of ["INSTRUCTOR", "MEMBER"]) {
      expect(mapLmsRole(role)).toBe("MENTOR");
    }
  });

  it("maps student/learner roles to VIEWER", () => {
    for (const role of ["STUDENT", "USER"]) {
      expect(mapLmsRole(role)).toBe("VIEWER");
    }
  });

  it("is case-insensitive for dirty role casing", () => {
    expect(mapLmsRole("student")).toBe("VIEWER");
    expect(mapLmsRole("Student")).toBe("VIEWER");
    expect(mapLmsRole("user")).toBe("VIEWER");
    expect(mapLmsRole("super_admin")).toBe("ADMIN");
  });

  it("defaults unknown or missing roles to VIEWER", () => {
    expect(mapLmsRole("ROOT")).toBe("VIEWER");
    expect(mapLmsRole(null)).toBe("VIEWER");
    expect(mapLmsRole(undefined)).toBe("VIEWER");
    expect(mapLmsRole("")).toBe("VIEWER");
  });
});