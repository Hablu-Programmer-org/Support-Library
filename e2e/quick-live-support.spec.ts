import { test, expect } from "@playwright/test";

/**
 * "Join Live support" on the issues page (owner decision, 2026-11-23).
 *
 * Live support starts from the student's own issue (reference number), so the
 * list button no longer enters the room: it opens a how-to dialog. The join
 * itself lives on the request page (`LiveSupportPanel`).
 */
test.describe("quick live support: students", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("Join Live support explains the issue-first flow in a dialog", async ({ page }) => {
    await page.goto("/dashboard/issues");

    const join = page.getByRole("button", { name: "Join Live support" });
    await expect(join).toBeEnabled();
    await join.click();

    const dialog = page.getByRole("dialog", { name: "How to get live support" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("Tell the mentor your reference number")).toBeVisible();
    await expect(dialog.getByRole("link", { name: "Create an issue" })).toHaveAttribute(
      "href",
      "/dashboard/issues/new",
    );
    // Direct join escape hatch; enabled state follows the server shift clock,
    // so only its presence is asserted. The room URL stays out of the document.
    await expect(dialog.getByRole("button", { name: "Join Live support" })).toBeVisible();
    expect(await page.content()).not.toContain("meet.google.com");

    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("offers Join Live support beside Create an issue", async ({ page }) => {
    await page.goto("/dashboard/issues");

    await expect(page.getByRole("link", { name: "Create an issue" })).toBeVisible();

    const join = page.getByRole("button", { name: "Join Live support" });
    await expect(join).toBeVisible();

    // The status message sits above Join. Both actions must still share one
    // visual baseline instead of vertically centring Submit against two rows.
    const submitBox = await page.getByRole("link", { name: "Create an issue" }).boundingBox();
    const joinBox = await join.boundingBox();
    expect(submitBox).not.toBeNull();
    expect(joinBox).not.toBeNull();
    expect(Math.abs((submitBox!.y + submitBox!.height) - (joinBox!.y + joinBox!.height))).toBeLessThanOrEqual(2);

    // The long schedule sentence lives only inside the (closed) dialog; it must
    // not distort the page header layout.
    await expect(page.getByText(/সকাল ৯ টা থেকে দুপুর ১ টা/)).toBeHidden();

    // The room URL and the meeting code are resolved by the action, never
    // shipped in the document.
    const html = await page.content();
    expect(html).not.toContain("meet.google.com");
    expect(html).not.toContain("abc-defg-hij");
  });
});

test.describe("quick live support: staff", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("is not offered to staff", async ({ page }) => {
    await page.goto("/dashboard/issues");

    await expect(page.getByRole("link", { name: "New Issue" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Join Live support" })).toHaveCount(0);
  });
});
