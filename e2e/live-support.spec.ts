import { test, expect } from "@playwright/test";

/**
 * Live support is a read-only join page: it opens the day's Zoom room during a
 * support slot and shows the meeting ID and passcode so a student can dial in
 * manually when the web client fails.
 */

test.describe("LIVE support: sign-in gate", () => {
  test("sends guests to login, remembering the page they wanted", async ({ page }) => {
    await page.goto("/dashboard/support");
    // Auth.js appends the intended destination, so a student lands back on the
    // join page after signing in instead of on the dashboard.
    await expect(page).toHaveURL("/login?callbackUrl=%2Fdashboard%2Fsupport");
  });
});

test.describe("LIVE support: join panel", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  // 02:00 UTC is 08:00 in Dhaka — the first minute of the morning slot.
  const IN_SLOT = new Date("2026-10-18T02:00:00Z");
  // 10:00 UTC is 16:00 in Dhaka — between the two slots.
  const OUT_OF_SLOT = new Date("2026-10-18T10:00:00Z");

  test("is reachable from the student nav", async ({ page }) => {
    await page.goto("/dashboard/issues");

    const nav = page.locator('header nav[aria-label="Primary"]');
    await expect(nav.getByRole("link", { name: "Live support" })).toBeVisible();
  });

  test("lets a student join inside a support slot", async ({ page }) => {
    await page.clock.install({ time: IN_SLOT });
    await page.goto("/dashboard/support");

    await expect(page.getByRole("heading", { name: "Live support" })).toBeVisible();
    await expect(page.getByText("Live support is open right now.")).toBeVisible();

    const join = page.getByRole("link", { name: "Live Support Center (Zoom)" });
    await expect(join).toHaveAttribute("aria-disabled", "false");
    await expect(join).toHaveAttribute("href", /^https:\/\//);
  });

  test("blocks the join and explains why outside a support slot", async ({ page }) => {
    await page.clock.install({ time: OUT_OF_SLOT });
    await page.goto("/dashboard/support");

    await expect(
      page.getByText("Live support is closed right now. Please join during a support slot."),
    ).toBeVisible();

    const join = page.getByRole("link", { name: "Live Support Center (Zoom)" });
    await expect(join).toHaveAttribute("aria-disabled", "true");
  });

  test("shows the meeting id and passcode for a manual dial-in", async ({ page }) => {
    await page.clock.install({ time: IN_SLOT });
    await page.goto("/dashboard/support");

    await expect(page.getByText("Meeting ID", { exact: true })).toBeVisible();
    await expect(page.getByText("Passcode", { exact: true })).toBeVisible();
    // Both values are selectable so they can be copied into the Zoom app.
    await expect(page.locator("main .select-all").first()).not.toBeEmpty();
  });
});
