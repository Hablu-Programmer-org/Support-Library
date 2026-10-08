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
      await expect(page.getByRole("heading", { name: "ড্যাশবোর্ড" })).toBeVisible();
    });

    test("can access cases list", async ({ page }) => {
      await page.goto("/dashboard/cases");
      await expect(page.getByRole("heading", { name: "সাপোর্ট কেস" })).toBeVisible();
    });

    test("can access solutions list", async ({ page }) => {
      await page.goto("/dashboard/solutions");
      await expect(page.getByRole("heading", { name: "সলিউশন লাইব্রেরি" })).toBeVisible();
    });

    const canMutate = role === "admin" || role === "mentor";

    test(`${canMutate ? "can" : "cannot"} create case`, async ({ page }) => {
      await page.goto("/dashboard/cases/new");
      if (canMutate) {
        await expect(page.getByRole("heading", { name: "নতুন সাপোর্ট কেস" })).toBeVisible();
      } else {
        await expect(page).toHaveURL(/\/unauthorized/);
      }
    });

    test(`${canMutate ? "can" : "cannot"} create solution`, async ({ page }) => {
      await page.goto("/dashboard/solutions/new");
      if (canMutate) {
        await expect(page.getByRole("heading", { name: "নতুন সলিউশন" })).toBeVisible();
      } else {
        await expect(page).toHaveURL(/\/unauthorized/);
      }
    });
  });
}