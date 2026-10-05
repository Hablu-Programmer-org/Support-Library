import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/mentor.json" });

test.describe("Solution CRUD (mentor)", () => {
  test("creates an INTERNAL solution and shows linked case state", async ({ page }) => {
    const suffix = Date.now().toString();
    const title = `E2E React useEffect loop fix ${suffix}`;

    await page.goto("/dashboard/solutions/new");
    await page.fill('input[name="title"]', title);
    await page.fill('textarea[name="summary"]', "Dependency array issue causes infinite loop");
    await page.fill('textarea[name="body"]', "Move unstable object/function dependencies out of render or memoize where needed.");
    await page.fill('input[name="tags"]', "react, useeffect, hooks");
    await Promise.all([
      page.waitForURL(/\/dashboard\/solutions\/(?!new$)[^/]+$/),
      page.click('button[type="submit"]'),
    ]);
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText("INTERNAL", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("এই solution এখনো কোনো case-এর সাথে linked না।")).toBeVisible();
  });
});
