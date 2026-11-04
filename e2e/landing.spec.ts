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
      page.getByRole("link", { name: "Students: browse published answers" }),
    ).toHaveCount(0);
    // No AI access hint and no student CTA before signing in.
    await expect(
      page.getByText("Need n8n access, password reset or OpenAI access?"),
    ).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Help & access/ })).toHaveCount(0);
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

test.describe("Landing AI access hint", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("points students at the dashboard instead of a second request form", async ({ page }) => {
    await page.goto("/");

    // The landing page never carries the access-request form: it only links to
    // the one place that owns it, so there is a single write path.
    await expect(page.getByRole("checkbox", { name: /n8n access/i })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Help & access/ })).toHaveAttribute(
      "href",
      "/dashboard/issues",
    );

    // Creating a request lives in the navigation only — the hero must not
    // duplicate it as a second primary call to action.
    await expect(page.getByRole("link", { name: "Submit a support request" })).toHaveCount(0);
    await expect(
      page.locator('header nav[aria-label="Primary"]').getByRole("link", { name: "Submit issue" }),
    ).toBeVisible();
  });
});