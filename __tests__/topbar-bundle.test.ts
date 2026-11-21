import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The topbar renders on every page, guests included. Anything it imports
 * statically ships to every visitor, so heavy, signed-in-only pieces must stay
 * behind a dynamic import.
 */
const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");
const topbar = read("components/layout/topbar.tsx");
const userMenu = read("components/auth/user-menu.tsx");

describe("Topbar bundle", () => {
  it("never statically imports the mobile menu (it carries framer-motion)", () => {
    expect(topbar).not.toMatch(/^import[^;]*["']@\/components\/layout\/mobile-menu["']/m);
    expect(topbar).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\(["']@\/components\/layout\/mobile-menu["']\)/);
  });

  it("renders the dynamic MobileMenu inside its own Suspense boundary", () => {
    // next/dynamic with ssr + no `loading` adds no boundary; without this one a
    // pending chunk blocks hydration of the whole page.
    expect(topbar).toMatch(/<Suspense fallback=\{[^}]+\}>\s*<MobileMenu\b/);
    expect(topbar.match(/<MobileMenu\b/g)).toHaveLength(1);
  });

  it("keeps the mobile menu's chunk marker out of the main bundle", () => {
    // e2e/landing.spec.ts finds the lazy chunk by MOBILE_MENU_ID; if the main
    // bundle carried it too, the chunk-delay test would delay the wrong file.
    expect(read("components/layout/mobile-menu.tsx")).toContain('"site-mobile-menu"');
    expect(topbar).not.toContain("site-mobile-menu");
    expect(userMenu).not.toContain("site-mobile-menu");
  });

  it("never imports framer-motion directly", () => {
    expect(topbar).not.toMatch(/from ["']framer-motion["']/);
    expect(userMenu).not.toMatch(/from ["']framer-motion["']/);
  });
});
