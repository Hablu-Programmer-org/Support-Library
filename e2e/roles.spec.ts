import { test as base, expect } from "@playwright/test";

const test = base.extend<{
  authState: string;
}>({
  authState: ["", { option: true }],
});

const roles = ["admin", "mentor", "viewer"] as const;

for (const role of roles) {
  test.describe(`Role matrix: ${role}`, () => {
    test.use({ storageState: `e2e/.auth/${role}.json` });

    test("can access dashboard", async ({ page }) => {
      await page.goto("/dashboard");
      await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    });

    test("can access issues list", async ({ page }) => {
      await page.goto("/dashboard/issues");
      await expect(page.getByRole("heading", { name: "Support Issues" })).toBeVisible();
    });

    const canMutate = role === "admin" || role === "mentor";

    test(`${canMutate ? "can" : "cannot"} create issue`, async ({ page }) => {
      await page.goto("/dashboard/issues/new");
      if (canMutate) {
        await expect(page.getByRole("heading", { name: "New Support Issue" })).toBeVisible();
      } else {
        await expect(page).toHaveURL(/\/unauthorized/);
      }
    });
  });
}