import { expect, test } from "@playwright/test";

test("public landing loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Staff Sign In" })).toBeVisible();
  await expect(page.locator("header")).toBeVisible();
  await expect(page.getByRole("search")).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator('meta[name="darkreader-lock"]')).toHaveAttribute("content", "true");
});

test("dashboard redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
});
