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

    // Inline nav: the staff links (Dashboard, Issues, Live support), the active
    // one highlighted and marked. "My Courses" is student-only and its LMS
    // origin is not set for e2e, so it never appears here.
    const nav = page.locator('header nav[aria-label="Primary"]');
    await expect(nav.getByRole("link")).toHaveCount(3);
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

    // The page background is the dark slate (theme default was zinc #18181b).
    // Allow small floating-point variance in lab() color space.
    const bgColor = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bgColor).toMatch(/^(rgb\(2, 6, 23\)|oklch\(0\.208 0\.042 265\.755\)|lab\(7\.78673 1\.8234[56] -15\.0537\))$/);
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

  test("account sheet opens with identity, appearance and sign out", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Account menu" }).click();

    const sheet = page.getByRole("dialog", { name: "Account menu" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Appearance")).toBeVisible();
    await expect(sheet.getByRole("button", { name: "Sign out" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
  });
});

test.describe("Shell: My Courses link (student)", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("leaves for the LMS in a new tab and never claims the active state", async ({ page }) => {
    await page.goto("/dashboard/issues");

    const nav = page.locator('header nav[aria-label="Primary"]');
    const myCourses = nav.getByRole("link", { name: "My Courses" });
    await expect(myCourses).toBeVisible();
    await expect(myCourses).toHaveAttribute("href", "https://www.hablu-programmer.com/dashboard/my-courses");
    await expect(myCourses).toHaveAttribute("target", "_blank");
    await expect(myCourses).toHaveAttribute("rel", /noopener/);
    // A different origin can never match this app's pathname, and the item is
    // excluded from the active-href calculation so it stays inert regardless.
    await expect(myCourses).not.toHaveAttribute("aria-current", "page");

    // The mentor-only Dashboard must not leak into the student nav.
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
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