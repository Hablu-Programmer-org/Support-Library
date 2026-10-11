import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/mentor.json" });

async function createIssueWithReply(page: import("@playwright/test").Page, body: string, emailTag: string) {
  await page.goto("/dashboard/issues/new");
  await page.fill('input[name="studentName"]', "E2E Edit Delete Student");
  await page.fill('input[name="studentEmail"]', `e2e.editdel.${emailTag}@test.com`);
  await page.fill('input[name="title"]', `E2E edit/delete ${emailTag}`);
  await page.fill('textarea[name="question"]', "How should reply edit and delete behave?");
  await Promise.all([
    page.waitForURL(/\/dashboard\/issues\/[a-f0-9]{24}$/),
    page.click('button[type="submit"]'),
  ]);

  const replyForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add response" }) });
  await replyForm.locator('textarea[name="body"]').fill(body);
  await replyForm.getByRole("button", { name: "Add response" }).click();

  const reply = page.locator('[data-testid^="reply-"]');
  await expect(reply).toContainText(body);
  return reply;
}

test.describe("Reply edit and delete interactions", () => {
  test("cancel keeps the body and save closes the editor", async ({ page }) => {
    const reply = await createIssueWithReply(page, "Original reply body", Date.now().toString());

    await reply.getByRole("button", { name: "Edit", exact: true }).click();
    const editor = reply.locator('textarea[name="body"]');
    await expect(editor).toBeVisible();

    await editor.fill("Never saved");
    await reply.getByRole("button", { name: "Cancel" }).click();
    await expect(reply.locator('textarea[name="body"]')).toHaveCount(0);
    await expect(reply).toContainText("Original reply body");
    await expect(reply).not.toContainText("Never saved");

    await reply.getByRole("button", { name: "Edit", exact: true }).click();
    await reply.locator('textarea[name="body"]').fill("Updated reply body");
    await reply.getByRole("button", { name: "Save" }).click();
    await expect(reply.locator('textarea[name="body"]')).toHaveCount(0);
    await expect(reply).toContainText("Updated reply body");
    await expect(reply).not.toContainText("Original reply body");
    await expect(reply).toContainText("edited");
  });

  test("delete only removes the reply after confirming", async ({ page }) => {
    const reply = await createIssueWithReply(page, "Reply to delete", Date.now().toString());

    page.once("dialog", (dialog) => dialog.dismiss());
    await reply.getByRole("button", { name: "Delete" }).click();
    await expect(reply).toContainText("Reply to delete");

    page.once("dialog", (dialog) => dialog.accept());
    await reply.getByRole("button", { name: "Delete" }).click();
    await expect(reply).toHaveCount(0);
  });
});