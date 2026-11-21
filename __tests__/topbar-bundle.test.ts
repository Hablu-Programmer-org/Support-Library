import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * The topbar renders on every page, guests included. Anything it imports
 * statically ships to every visitor, so heavy, signed-in-only pieces must stay
 * behind a dynamic import.
 */
const topbar = readFileSync(resolve(process.cwd(), "components/layout/topbar.tsx"), "utf8");

describe("Topbar bundle", () => {
  it("never statically imports the account sheet (it carries framer-motion)", () => {
    expect(topbar).not.toMatch(/^import[^;]*["']@\/components\/layout\/account-sheet["']/m);
    expect(topbar).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\(["']@\/components\/layout\/account-sheet["']\)/);
  });

  it("renders the dynamic AccountSheet inside its own Suspense boundary", () => {
    // next/dynamic with ssr + no `loading` adds no boundary; without this one a
    // pending chunk blocks hydration of the whole page.
    expect(topbar).toMatch(/<Suspense fallback=\{[^}]+\}>\s*<AccountSheet\b/);
    expect(topbar.match(/<AccountSheet\b/g)).toHaveLength(1);
  });

  it("never imports framer-motion directly", () => {
    expect(topbar).not.toMatch(/from ["']framer-motion["']/);
  });
});
