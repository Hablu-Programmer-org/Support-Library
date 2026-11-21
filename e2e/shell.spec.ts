import { test, expect } from "@playwright/test";

import { STAFF_USERS } from "./fixtures/staff-users";

const adminUser = STAFF_USERS.find((user) => user.role === "ADMIN")!;

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

    // Inline nav: the admin links (Dashboard, Issues, Live support, Support
    // queue, Access requests), the active one highlighted and marked. "My Courses" is
    // student-only and its LMS origin is not set for e2e, so it never appears
    // here.
    const nav = page.locator('header nav[aria-label="Primary"]');
    await expect(nav.getByRole("link")).toHaveCount(5);
    await expect(nav.getByRole("link", { name: "Support queue" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Access requests" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "n8n help" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Issues" })).not.toHaveAttribute("aria-current", "page");

    const activeColor = await nav
      .getByRole("link", { name: "Dashboard" })
      .evaluate((el) => getComputedStyle(el).color);
    const inactiveColor = await nav
      .getByRole("link", { name: "Issues" })
      .evaluate((el) => getComputedStyle(el).color);
    expect(activeColor).not.toBe(inactiveColor);

    // v2-style underline: a 2px bar on the active link only.
    const underline = (name: string) =>
      nav.getByRole("link", { name }).evaluate((el) => {
        const after = getComputedStyle(el, "::after");
        return { content: after.content, height: after.height };
      });
    expect(await underline("Dashboard")).toEqual({ content: '""', height: "2px" });
    expect((await underline("Issues")).content).toBe("none");

    // Navigation keeps the active link in sync on the client.
    await nav.getByRole("link", { name: "Issues" }).click();
    await expect(page.getByRole("heading", { name: "Support Issues" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Issues" })).toHaveAttribute("aria-current", "page");
    await expect(nav.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute("aria-current", "page");
  });

  test("profile dropdown shows identity and closes on Escape", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    const trigger = page.getByRole("button", { name: "Profile menu" });
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
    await trigger.click();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    const panel = page.locator(`[id="${await trigger.getAttribute("aria-controls")}"]`);
    await expect(panel).toBeVisible();
    await expect(panel.getByText(adminUser.email)).toBeVisible();
    await expect(panel.getByText("Admin", { exact: true })).toBeVisible();
    // Visible only: clicking it would end the shared admin session.
    await expect(panel.getByRole("button", { name: "Sign out" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(trigger).toBeFocused();
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

  test("hamburger menu lists the links, navigates and closes", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();

    // Below lg the inline nav is hidden; the brand stays.
    await expect(page.locator('header nav[aria-label="Primary"]')).toBeHidden();
    await expect(page.locator("header").getByRole("link", { name: "Hablu Support Library home" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);

    await page.getByRole("button", { name: "Open menu" }).click();
    const menu = page.getByRole("navigation", { name: "Mobile" });
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("link")).toHaveCount(5);
    await expect(menu.getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    await expect(page.getByText("Appearance")).toBeVisible();

    await menu.getByRole("link", { name: "Issues" }).click();
    await expect(page.getByRole("heading", { name: "Support Issues" })).toBeVisible();
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
  });

  test("Escape closes the menu and returns focus to the hamburger", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("navigation", { name: "Mobile" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();
  });

  test("profile menu is reachable on mobile with identity and sign out", async ({ page }) => {
    await page.goto("/dashboard");
    const trigger = page.getByRole("button", { name: "Profile menu" });
    await expect(trigger).toBeVisible();
    await trigger.click();

    const panel = page.locator(`[id="${await trigger.getAttribute("aria-controls")}"]`);
    await expect(panel.getByText(adminUser.email)).toBeVisible();
    // Visible only: clicking it would end the shared admin session.
    await expect(panel.getByRole("button", { name: "Sign out" })).toBeVisible();
    // The panel fits the phone width.
    const box = await panel.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= 390).toBe(true);
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
    // Students reach the room from their own request, so the staff room page and
    // the queue are not in their nav; their requests are.
    await expect(nav.getByRole("link", { name: "My issues" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Live support" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Support queue" })).toHaveCount(0);
    // Issues, Submit issue, My issues, My Courses.
    await expect(nav.getByRole("link")).toHaveCount(4);
  });
});

test.describe("Shell: n8n admin link (mentor)", () => {
  test.use({ storageState: "e2e/.auth/mentor.json" });

  test("does not expose the n8n request queue to mentors", async ({ page }) => {
    await page.goto("/dashboard");
    const nav = page.locator('header nav[aria-label="Primary"]');
    await expect(nav.getByRole("link", { name: "Access requests" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "n8n help" })).toHaveCount(0);
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
