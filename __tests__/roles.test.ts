import { describe, it, expect } from "vitest";
import { canCreateIssue, canMutate, hasRole, isAdmin, ROLE_RANK, USER_ROLES } from "@/lib/roles";

describe("roles", () => {
  it("USER_ROLES has correct values", () => {
    expect(USER_ROLES).toEqual(["ADMIN", "MENTOR", "STUDENT"]);
  });

  describe("ROLE_RANK", () => {
    it("ADMIN > MENTOR > STUDENT", () => {
      expect(ROLE_RANK.ADMIN).toBeGreaterThan(ROLE_RANK.MENTOR);
      expect(ROLE_RANK.MENTOR).toBeGreaterThan(ROLE_RANK.STUDENT);
    });
  });

  describe("hasRole", () => {
    it("ADMIN has all roles", () => {
      expect(hasRole("ADMIN", "ADMIN")).toBe(true);
      expect(hasRole("ADMIN", "MENTOR")).toBe(true);
      expect(hasRole("ADMIN", "STUDENT")).toBe(true);
    });
    it("MENTOR has MENTOR and STUDENT", () => {
      expect(hasRole("MENTOR", "ADMIN")).toBe(false);
      expect(hasRole("MENTOR", "MENTOR")).toBe(true);
      expect(hasRole("MENTOR", "STUDENT")).toBe(true);
    });
    it("STUDENT only has STUDENT", () => {
      expect(hasRole("STUDENT", "ADMIN")).toBe(false);
      expect(hasRole("STUDENT", "MENTOR")).toBe(false);
      expect(hasRole("STUDENT", "STUDENT")).toBe(true);
    });
  });

  describe("isAdmin", () => {
    it("returns true only for ADMIN", () => {
      expect(isAdmin("ADMIN")).toBe(true);
      expect(isAdmin("MENTOR")).toBe(false);
      expect(isAdmin("STUDENT")).toBe(false);
    });
  });

  describe("canMutate", () => {
    it("ADMIN and MENTOR can mutate, STUDENT cannot", () => {
      expect(canMutate("ADMIN")).toBe(true);
      expect(canMutate("MENTOR")).toBe(true);
      expect(canMutate("STUDENT")).toBe(false);
    });
  });

  describe("canCreateIssue", () => {
    it("every role may submit a request", () => {
      expect(canCreateIssue("ADMIN")).toBe(true);
      expect(canCreateIssue("MENTOR")).toBe(true);
      expect(canCreateIssue("STUDENT")).toBe(true);
    });

    it("denies users with no resolved role", () => {
      expect(canCreateIssue(undefined)).toBe(false);
      expect(canCreateIssue(null)).toBe(false);
    });
  });
});
