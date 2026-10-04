import { describe, it, expect } from "vitest";
import { normalizeEmail, parseAllowlist, isAllowlisted } from "@/lib/auth-allowlist";

describe("auth-allowlist", () => {
  describe("normalizeEmail", () => {
    it("lowercases and trims", () => {
      expect(normalizeEmail("  Test@Example.COM  ")).toBe("test@example.com");
    });
    it("handles null/undefined", () => {
      expect(normalizeEmail(null)).toBe("");
      expect(normalizeEmail(undefined)).toBe("");
    });
  });

  describe("parseAllowlist", () => {
    it("splits comma-separated emails", () => {
      expect(parseAllowlist("a@b.com, c@d.com")).toEqual(["a@b.com", "c@d.com"]);
    });
    it("trims and drops empty", () => {
      expect(parseAllowlist(" a@b.com , , c@d.com ")).toEqual(["a@b.com", "c@d.com"]);
    });
    it("handles domain wildcards", () => {
      expect(parseAllowlist("@example.com")).toEqual(["@example.com"]);
    });
    it("empty string returns empty array", () => {
      expect(parseAllowlist("")).toEqual([]);
    });
  });

  describe("isAllowlisted", () => {
    const allowlist = ["admin@example.com", "@hablu-programmer.com"];

    it("exact match", () => {
      expect(isAllowlisted("admin@example.com", allowlist)).toBe(true);
    });
    it("domain wildcard match", () => {
      expect(isAllowlisted("mentor@hablu-programmer.com", allowlist)).toBe(true);
    });
    it("case insensitive", () => {
      expect(isAllowlisted("ADMIN@EXAMPLE.COM", allowlist)).toBe(true);
    });
    it("rejects non-allowlisted", () => {
      expect(isAllowlisted("outsider@gmail.com", allowlist)).toBe(false);
    });
    it("rejects null/undefined/empty", () => {
      expect(isAllowlisted(null, allowlist)).toBe(false);
      expect(isAllowlisted(undefined, allowlist)).toBe(false);
      expect(isAllowlisted("", allowlist)).toBe(false);
    });
    it("rejects if allowlist empty", () => {
      expect(isAllowlisted("admin@example.com", [])).toBe(false);
    });
  });
});