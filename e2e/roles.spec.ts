import { test as base, expect } from "@playwright/test";

const test = base.extend<{
  authState: string;
}>({
  authState: ["", { option: true }],
});

const roles = ["admin", "mentor", "student"] as const;

for (const role of roles) {
  test.describe(`Role matrix: ${role}`, () => {
    test.use({ storageState: `e2e/.auth/${role}.json` });

    test("can access dashboard", async ({ page }) => {
      await page.goto("/dashboard");
      if (role === "student") {
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
          name: role === "student" ? "Student Support Library" : "Support Issues",
        }),
      ).toBeVisible();
    });

    const canManage = role === "admin" || role === "mentor";

    test(`${canManage ? "can" : "cannot"} open the staff create form`, async ({ page }) => {
      await page.goto("/dashboard/issues/new");
      if (canManage) {
        await expect(page.getByRole("heading", { name: "New Support Issue" })).toBeVisible();
      } else {
        // A student gets the create-only form instead of the staff form.
        await expect(page.getByRole("heading", { name: "Submit a support request" })).toBeVisible();
        await expect(page.getByRole("heading", { name: "New Support Issue" })).toHaveCount(0);
      }
    });

    test(`${canManage ? "can" : "cannot"} open the issue editor`, async ({ page }) => {
      await page.goto("/dashboard/issues/507f1f77bcf86cd799439011/edit");
      if (canManage) {
        await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
      } else {
        await expect(page).toHaveURL(/\/unauthorized/);
      }
    });
  });
}
