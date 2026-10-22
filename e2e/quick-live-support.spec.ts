import { test, expect } from "@playwright/test";

/**
 * TEMPORARY quick join (owner request, to be removed).
 *
 * Students were asking for live support without submitting a request first, so
 * the issues page carries a "Join live support" shortcut next to "Submit an
 * issue": it explains the request-first path and still offers a join button.
 *
 * The join itself is not clicked here: whether the room is open depends on the
 * server clock, and following the redirect would leave the test on Zoom. The
 * shift matrix lives in `__tests__/live-support.test.ts`.
 */
test.describe("TEMPORARY quick live support", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("opens the popup with the submit-first guidance and a join button", async ({ page }) => {
    await page.goto("/dashboard/issues");

    const trigger = page.getByRole("button", { name: "Join live support" });
    await expect(trigger).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await trigger.click();

    const dialog = page.getByRole("dialog", { name: "Join live support" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/so the mentor can see your problem/)).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Submit an issue" })).toHaveAttribute(
      "href",
      "/dashboard/issues/new",
    );
    await expect(dialog.getByRole("button", { name: "Join Zoom Meeting" })).toBeVisible();

    // The room URL is resolved by the action, never shipped in the document.
    expect(await page.content()).not.toContain("zoom.us");

    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("TEMPORARY quick live support: staff", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("is not offered to staff", async ({ page }) => {
    await page.goto("/dashboard/issues");

    await expect(page.getByRole("link", { name: "New Issue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Join live support" })).toHaveCount(0);
  });
});
