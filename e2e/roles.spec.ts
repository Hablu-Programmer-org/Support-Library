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
      if (role === "viewer") {
        await expect(page).toHaveURL(/\/dashboard\/issues/);
        await expect(page.getByRole("heading", { name: "Student Support Library" })).toBeVisible();
      } else {
        await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
      }
    });

    test("can access issues list", async ({ page }) => {
      await page.goto("/dashboard/issues");
      await expect(
        page.getByRole("heading", {
          name: role === "viewer" ? "Student Support Library" : "Support Issues",
        }),
      ).toBeVisible();
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

    test(`${canMutate ? "can" : "cannot"} open the issue editor`, async ({ page }) => {
      await page.goto("/dashboard/issues/507f1f77bcf86cd799439011/edit");
      if (canMutate) {
        await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
      } else {
        await expect(page).toHaveURL(/\/unauthorized/);
      }
    });
  });
}
