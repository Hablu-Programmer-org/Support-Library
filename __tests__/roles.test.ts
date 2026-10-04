import { describe, it, expect } from "vitest";
import { hasRole, isAdmin, canMutate, ROLE_RANK, USER_ROLES } from "@/lib/roles";

describe("roles", () => {
  it("USER_ROLES has correct values", () => {
    expect(USER_ROLES).toEqual(["ADMIN", "MENTOR", "VIEWER"]);
  });

  describe("ROLE_RANK", () => {
    it("ADMIN > MENTOR > VIEWER", () => {
      expect(ROLE_RANK.ADMIN).toBeGreaterThan(ROLE_RANK.MENTOR);
      expect(ROLE_RANK.MENTOR).toBeGreaterThan(ROLE_RANK.VIEWER);
    });
  });

  describe("hasRole", () => {
    it("ADMIN has all roles", () => {
      expect(hasRole("ADMIN", "ADMIN")).toBe(true);
      expect(hasRole("ADMIN", "MENTOR")).toBe(true);
      expect(hasRole("ADMIN", "VIEWER")).toBe(true);
    });
    it("MENTOR has MENTOR and VIEWER", () => {
      expect(hasRole("MENTOR", "ADMIN")).toBe(false);
      expect(hasRole("MENTOR", "MENTOR")).toBe(true);
      expect(hasRole("MENTOR", "VIEWER")).toBe(true);
    });
    it("VIEWER only has VIEWER", () => {
      expect(hasRole("VIEWER", "ADMIN")).toBe(false);
      expect(hasRole("VIEWER", "MENTOR")).toBe(false);
      expect(hasRole("VIEWER", "VIEWER")).toBe(true);
    });
  });

  describe("isAdmin", () => {
    it("returns true only for ADMIN", () => {
      expect(isAdmin("ADMIN")).toBe(true);
      expect(isAdmin("MENTOR")).toBe(false);
      expect(isAdmin("VIEWER")).toBe(false);
    });
  });

  describe("canMutate", () => {
    it("ADMIN and MENTOR can mutate", () => {
      expect(canMutate("ADMIN")).toBe(true);
      expect(canMutate("MENTOR")).toBe(true);
      expect(canMutate("VIEWER")).toBe(false);
    });
  });
});