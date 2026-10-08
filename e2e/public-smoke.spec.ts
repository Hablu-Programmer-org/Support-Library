import { expect, test } from "@playwright/test";

test("public landing loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Staff Sign In" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});

test("dashboard redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Sign in with Google" })).toBeVisible();
});
