import { test, expect } from "@playwright/test";

test.describe("Shell: dashboard chrome", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("topbar + collapsible sidebar match the frontend design", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "ড্যাশবোর্ড" })).toBeVisible();

    const header = page.locator("header").first();
    await expect(header).toHaveCSS("position", "fixed");
    const hb = await header.boundingBox();
    expect(hb?.height).toBe(64);
    // bg-slate-950/80 backdrop-blur (always dark)
    expect(await header.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe("rgba(2, 6, 23, 0.8)");

    const aside = page.locator("aside").first();
    const w1 = (await aside.boundingBox())?.width ?? 0;
    expect(Math.abs(w1 - 70)).toBeLessThan(3);

    // exactly one active nav item, label in cyan
    const active = page.locator('aside a[aria-current="page"]');
    await expect(active).toHaveCount(1);
    expect(
      await active.first().locator("span").first().evaluate((el) => getComputedStyle(el).color),
    ).toBe("rgb(6, 182, 212)");

    // expand
    await page.locator("header button:visible").first().click();
    await expect
      .poll(async () => (await aside.boundingBox())?.width ?? 0)
      .toBeGreaterThanOrEqual(318);

    // collapse
    await page.locator("header button:visible").first().click();
    await expect
      .poll(async () => (await aside.boundingBox())?.width ?? 999)
      .toBeLessThanOrEqual(72);
  });

  test("cases list keeps native filter selects", async ({ page }) => {
    await page.goto("/dashboard/cases");
    await expect(page.getByRole("heading", { name: "সাপোর্ট কেস" })).toBeVisible();
    await expect(page.locator("select[name]")).toHaveCount(4);
  });
});

test.describe("Shell: mobile drawer", () => {
  test.use({ storageState: "e2e/.auth/admin.json", viewport: { width: 390, height: 844 } });

  test("sidebar is off-canvas and opens as a drawer", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "ড্যাশবোর্ড" })).toBeVisible();

    const aside = page.locator("aside").first();
    const b1 = await aside.boundingBox();
    expect((b1?.x ?? 0) + (b1?.width ?? 0)).toBeLessThanOrEqual(1);

    await page.locator("header button:visible").first().click();
    await expect.poll(async () => (await aside.boundingBox())?.x ?? -1).toBe(0);
    await expect(page.locator("div.fixed.inset-0").first()).toBeVisible();

    await page.keyboard.press("Escape");
    await expect
      .poll(async () => {
        const b = await aside.boundingBox();
        return (b?.x ?? 0) + (b?.width ?? 0);
      })
      .toBeLessThanOrEqual(1);
  });
});

test.describe("Shell: public pages", () => {
  test("landing renders dark by default with cyan CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(await page.locator("main").evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
      "rgb(2, 6, 23)",
    );
    expect(
      await page
        .locator('a[href="/login"]')
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    ).toBe("rgb(6, 182, 212)");
  });
});
