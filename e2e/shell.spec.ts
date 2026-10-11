import { test, expect } from "@playwright/test";

const slate950 = ["rgb(2, 6, 23)", "oklch(0.129 0.042 264.695)", "lab(1.76974 1.32743 -9.28855)"];
const slate950Alpha80 = [
  "rgba(2, 6, 23, 0.8)",
  "oklab(0.129 -0.0038832 -0.0418201 / 0.8)",
  "oklab(0.129 -0.00388322 -0.0418201 / 0.8)",
  "oklab(0.128998 -0.0038857 -0.0418156 / 0.8)",
];
const whiteAlpha80 = ["rgba(255, 255, 255, 0.8)", "oklab(0.999994 0.0000455677 0.0000200868 / 0.8)"];
const cyan500 = ["rgb(6, 182, 212)", "oklch(0.715 0.143 215.221)", "lab(67.805 -35.3952 -30.2018)"];

test.describe("Shell: dashboard chrome", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("topbar with inline nav matches the frontend design", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    const header = page.locator("header").first();
    await expect(header).toHaveCSS("position", "fixed");
    const hb = await header.boundingBox();
    expect(hb?.height).toBe(64);
    // dark: bg-slate-950/80 backdrop-blur
    expect(slate950Alpha80).toContain(await header.evaluate((el) => getComputedStyle(el).backgroundColor));

    // body is slate-950 in dark (HeroUI default background was pure black)
    expect(slate950).toContain(await page.evaluate(() => getComputedStyle(document.body).backgroundColor));

    // Bar follows the theme: switching to light turns the chrome light too.
    await page.getByRole("button", { name: "Light mode" }).click();
    await expect
      .poll(async () => whiteAlpha80.includes(await header.evaluate((el) => getComputedStyle(el).backgroundColor)))
      .toBe(true);
    await page.getByRole("button", { name: "Dark mode" }).click();
    await expect
      .poll(async () => slate950Alpha80.includes(await header.evaluate((el) => getComputedStyle(el).backgroundColor)))
      .toBe(true);

    // Inline nav: the two staff links, the active one highlighted and marked.
    const nav = page.locator('header nav[aria-label="Primary"]');
    await expect(nav.getByRole("link")).toHaveCount(2);
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Issues" })).not.toHaveAttribute("aria-current", "page");

    const activeColor = await nav
      .getByRole("link", { name: "Dashboard" })
      .evaluate((el) => getComputedStyle(el).color);
    const inactiveColor = await nav
      .getByRole("link", { name: "Issues" })
      .evaluate((el) => getComputedStyle(el).color);
    expect(activeColor).not.toBe(inactiveColor);

    // Navigation keeps the active link in sync on the client.
    await nav.getByRole("link", { name: "Issues" }).click();
    await expect(page.getByRole("heading", { name: "Support Issues" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Issues" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current", "page");
  });

  test("issues list keeps native filter selects", async ({ page }) => {
    await page.goto("/dashboard/issues");
    await expect(page.getByRole("heading", { name: "Support Issues" })).toBeVisible();

    // Filters are collapsed by default; the arrow toggle reveals them.
    await page.getByRole("button", { name: "Advanced filters" }).click();
    await expect(page.locator("main select[name]:visible")).toHaveCount(5);

    // Native card surfaces are slate-900 in dark (theme default was zinc #18181b)
    expect(
      ["rgb(15, 23, 42)", "oklch(0.208 0.042 265.755)", "lab(7.78673 1.82346 -15.0537)"],
    ).toContain(await page.locator("main section").first().evaluate((el) => getComputedStyle(el).backgroundColor));
  });
});

test.describe("Shell: mobile navbar", () => {
  test.use({ storageState: "e2e/.auth/admin.json", viewport: { width: 390, height: 844 } });

  test("nav links and brand stay visible on mobile and navigate", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    const nav = page.locator('header nav[aria-label="Primary"]');
    await expect(nav.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Issues" })).toBeVisible();

    await nav.getByRole("link", { name: "Issues" }).click();
    await expect(page.getByRole("heading", { name: "Support Issues" })).toBeVisible();
  });
});

test.describe("Shell: public pages", () => {
  test("landing renders dark by default with cyan CTA", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveClass(/dark/);
    expect(slate950).toContain(await page.locator("main").evaluate((el) => getComputedStyle(el).backgroundColor));
    expect(
      cyan500,
    ).toContain(
      await page
        .locator('a[href="/login"]')
        .first()
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    );
  });
});