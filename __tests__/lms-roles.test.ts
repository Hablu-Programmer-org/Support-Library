import { describe, expect, it } from "vitest";

import { mapLmsRole } from "@/lib/lms-roles";

describe("mapLmsRole", () => {
  it("maps senior/staff roles to ADMIN", () => {
    for (const role of ["SUPER_ADMIN", "ADMIN", "MANAGER", "COORDINATOR", "MODERATOR"]) {
      expect(mapLmsRole(role)).toBe("ADMIN");
    }
  });

  it("maps teaching roles to MENTOR", () => {
    for (const role of ["INSTRUCTOR"]) {
      expect(mapLmsRole(role)).toBe("MENTOR");
    }
  });

  it("maps student/learner roles to STUDENT", () => {
    for (const role of ["MEMBER", "STUDENT", "USER"]) {
      expect(mapLmsRole(role)).toBe("STUDENT");
    }
  });

  it("is case-insensitive for dirty role casing", () => {
    expect(mapLmsRole("student")).toBe("STUDENT");
    expect(mapLmsRole("Student")).toBe("STUDENT");
    expect(mapLmsRole("user")).toBe("STUDENT");
    expect(mapLmsRole("super_admin")).toBe("ADMIN");
  });

  it("defaults unknown or missing roles to STUDENT", () => {
    expect(mapLmsRole("ROOT")).toBe("STUDENT");
    expect(mapLmsRole(null)).toBe("STUDENT");
    expect(mapLmsRole(undefined)).toBe("STUDENT");
    expect(mapLmsRole("")).toBe("STUDENT");
  });
});
