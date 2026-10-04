import { expect, test } from "@playwright/test";

test("public landing loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "স্টাফ লগইন" })).toBeVisible();
});

test("dashboard redirects unauthenticated users to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("button", { name: "Google দিয়ে লগইন করুন" })).toBeVisible();
});
