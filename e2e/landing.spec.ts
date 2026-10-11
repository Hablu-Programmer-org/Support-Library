import { expect, test } from "@playwright/test";

test.describe("Landing", () => {
  test("guest sees only the sign-in path, no library chrome", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("header")).toBeVisible();
    await expect(page.getByRole("link", { name: "Staff Sign In" })).toBeVisible();
    // Guest chrome is hidden: no nav links, no search box, no student CTA.
    await expect(
      page.locator('header nav[aria-label="Primary"]').getByRole("link"),
    ).toHaveCount(0);
    await expect(page.getByRole("search")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Students: browse published solutions" }),
    ).toHaveCount(0);
  });
});

test.describe("Landing library search", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("search button deep-links to the issues query", async ({ page }) => {
    await page.goto("/");
    const input = page.getByRole("search").locator('input[type="search"]');
    await input.fill("react hooks");
    await input.press("Enter");
    await expect(page).toHaveURL(/\/dashboard\/issues\?q=react%20hooks/);
    await expect(page.getByRole("heading", { name: "Support Issues" })).toBeVisible();
  });
});
