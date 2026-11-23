import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { copyFor } from "@/lib/landing-copy";
import type { UserRole } from "@/lib/roles";

const hrefs = (role: UserRole | null | undefined) => {
  const { copy } = copyFor(role);
  return [...copy.ctas.map((cta) => cta.href), ...copy.cards.flatMap((card) => card.href ?? [])];
};

describe("copyFor (landing copy per audience)", () => {
  it("guest gets only the sign-in CTA and no dashboard links", () => {
    const view = copyFor(undefined);
    expect(view.staff).toBe(false);
    expect(view.student).toBe(false);
    expect(view.copy.ctas).toEqual([{ label: "Sign in to get help", href: "/login", variant: "primary" }]);
    expect(hrefs(undefined).some((href) => href.startsWith("/dashboard"))).toBe(false);
  });

  it("null role is treated as a guest", () => {
    expect(copyFor(null)).toEqual(copyFor(undefined));
  });

  it("student gets answers + my issues, never staff-only routes", () => {
    const view = copyFor("STUDENT");
    expect(view.student).toBe(true);
    expect(view.staff).toBe(false);
    expect(view.copy.ctas.map((cta) => [cta.label, cta.href])).toEqual([
      ["Browse answers", "/dashboard/issues"],
      ["My issues", "/dashboard/my-issues"],
    ]);
    const studentHrefs = hrefs("STUDENT");
    expect(studentHrefs).not.toContain("/dashboard");
    expect(studentHrefs).not.toContain("/dashboard/support");
  });

  it.each(["MENTOR", "ADMIN"] as const)("%s gets the staff view", (role) => {
    const view = copyFor(role);
    expect(view.staff).toBe(true);
    expect(view.student).toBe(false);
    expect(view.copy.ctas.map((cta) => cta.href)).toEqual(["/dashboard", "/dashboard/issues"]);
  });

  it.each(["SUPERADMIN", "admin", "", "__proto__"])(
    "unknown role %j falls back to guest (no staff links)",
    (role) => {
      const view = copyFor(role as UserRole);
      expect(view.staff).toBe(false);
      expect(view.student).toBe(false);
      expect(hrefs(role as UserRole)).toEqual(["/login"]);
    },
  );

  it("every view has exactly one primary CTA", () => {
    for (const role of [undefined, "STUDENT", "MENTOR", "ADMIN"] as const) {
      const primaries = copyFor(role).copy.ctas.filter((cta) => cta.variant === "primary");
      expect(primaries).toHaveLength(1);
    }
  });
});

describe("landing motion CSS", () => {
  const css = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf8");

  it("disables every landing animation under prefers-reduced-motion", () => {
    const blocks = css.split("@media (prefers-reduced-motion: reduce)").slice(1);
    const reduced = blocks.find((block) => block.includes(".landing-rise")) ?? "";
    for (const name of ["landing-rise", "landing-slide", "landing-underline", "landing-glow", "landing-ping"]) {
      expect(reduced, name).toContain(`.${name}`);
    }
    expect(reduced).toContain("animation: none");
  });

  it("never fades the headline: landing-slide animates transform only", () => {
    const slide = css.match(/@keyframes landing-slide \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(slide).toContain("transform");
    expect(slide).not.toContain("opacity");
  });

  it("card reveal only exists behind @supports + no-preference, so cards are never stuck hidden", () => {
    const occurrences = [...css.matchAll(/\.landing-card-reveal\b/g)].map((match) => match.index ?? 0);
    expect(occurrences).toHaveLength(1);
    const supportsAt = css.indexOf("@supports (animation-timeline: view())");
    const noPreferenceAt = css.indexOf("@media (prefers-reduced-motion: no-preference)", supportsAt);
    expect(supportsAt).toBeGreaterThan(-1);
    expect(noPreferenceAt).toBeGreaterThan(supportsAt);
    expect(occurrences[0]).toBeGreaterThan(noPreferenceAt);
  });

  it("card hover glow is scoped to hover-capable devices and link cards only", () => {
    const hoverRules = [...css.matchAll(/^[^\n{]*\.landing-card:hover[^\n{]*/gm)].map((match) => match[0]);
    expect(hoverRules.length).toBeGreaterThan(0);
    for (const rule of hoverRules) expect(rule.trim().startsWith("a.landing-card:hover")).toBe(true);
    const hoverMedia = css.indexOf("@media (hover: hover)");
    expect(hoverMedia).toBeGreaterThan(-1);
    expect(css.indexOf("a.landing-card:hover")).toBeGreaterThan(hoverMedia);
  });

  it("card border glow fades only opacity", () => {
    const rules = [...css.matchAll(/([^{}]*\.landing-card::[^{}]*)\{([^{}]*)\}/g)];
    const transitions = rules.flatMap(([, , body]) =>
      [...body.matchAll(/transition:\s*([^;]+);/g)].map((match) => match[1].trim()),
    );
    expect(transitions.length).toBeGreaterThan(0);
    for (const value of transitions) expect(value).toMatch(/^(opacity\b|none$)/);
  });

  it("card gradient border is a masked ring, written as longhands without manual prefixes", () => {
    const before = css.match(/\n\.landing-card::before \{([^}]*)\}/)?.[1] ?? "";
    expect(before).toMatch(/mask-composite:\s*exclude;/);
    expect(before).toMatch(/mask-clip:\s*content-box,\s*border-box;/);
    expect(before).not.toMatch(/-webkit-mask/);
    expect(before).not.toMatch(/(^|[^-])mask:/);
  });

  it("landing <main> never becomes a scroll container (it would freeze the view() reveal)", () => {
    const page = readFileSync(resolve(process.cwd(), "app/page.tsx"), "utf8");
    const main = page.match(/<main className="([^"]*)"/)?.[1] ?? "";
    expect(main).toContain("overflow-clip");
    expect(main).not.toMatch(/overflow-(hidden|auto|scroll)/);
  });

  it("landing keyframes animate only transform/opacity (no layout properties)", () => {
    const keyframes = css.match(/@keyframes landing-[\w-]+ \{[\s\S]*?\n\}/g) ?? [];
    expect(keyframes.length).toBeGreaterThanOrEqual(6);
    for (const block of keyframes) {
      const props = [...block.matchAll(/^\s*([a-z-]+):/gm)].map((match) => match[1]);
      for (const prop of props) expect(["transform", "opacity"]).toContain(prop);
    }
  });
});
