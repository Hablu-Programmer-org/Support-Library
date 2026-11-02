import { test, expect } from "@playwright/test";

/**
 * Request-less quick join on the issues page (owner decision, 2026-11-01).
 *
 * Students can enter the room straight from the list, without a request. The
 * join itself is not clicked here: the room is only open inside a support shift
 * (Asia/Dhaka, server clock), and following the link would leave the test on the
 * external room. The open/closed matrix and the action's checks live in
 * `__tests__/live-support.test.ts` and `__tests__/quick-live-support.test.tsx`.
 */
test.describe("quick live support: students", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("offers a direct join beside Submit an issue, matching the shift", async ({ page }) => {
    await page.goto("/dashboard/issues");

    await expect(page.getByRole("link", { name: "Submit an issue" })).toBeVisible();

    const join = page.getByRole("button", { name: "Join Live support" });
    await expect(join).toBeVisible();

    // The status message sits above Join. Both actions must still share one
    // visual baseline instead of vertically centring Submit against two rows.
    const submitBox = await page.getByRole("link", { name: "Submit an issue" }).boundingBox();
    const joinBox = await join.boundingBox();
    expect(submitBox).not.toBeNull();
    expect(joinBox).not.toBeNull();
    expect(Math.abs((submitBox!.y + submitBox!.height) - (joinBox!.y + joinBox!.height))).toBeLessThanOrEqual(2);

    // The server resolves the shift and only marks the button clickable inside
    // a support slot, so the status line and the button must never disagree.
    const status = page.getByText(
      /Live support is open right now\.|Closed right now|Live support is unavailable right now\./,
    );
    await expect(status).toBeVisible();

    const text = (await status.textContent()) ?? "";
    if (text.includes("open right now")) {
      await expect(join).toBeEnabled();
    } else {
      await expect(join).toBeDisabled();
    }

    // Closed state still tells the student when support runs.
    if (text.includes("Closed")) {
      await expect(status).toContainText("সকাল");
    }

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
