import { test, expect } from "@playwright/test";

import { formFor, submitAndWait } from "./form-helpers";

test.use({ storageState: "e2e/.auth/mentor.json" });

const ISSUE_URL = /\/dashboard\/issues\/[a-f0-9]{24}$/;

async function createIssueWithReply(page: import("@playwright/test").Page, body: string, emailTag: string) {
  await page.goto("/dashboard/issues/new");
  const form = formFor(page, "Create Issue");
  await form.locator('input[name="studentName"]').fill("E2E Edit Delete Student");
  await form.locator('input[name="studentEmail"]').fill(`e2e.editdel.${emailTag}@test.com`);
  await form.locator('input[name="title"]').fill(`E2E edit/delete ${emailTag}`);
  await form.locator('textarea[name="question"]').fill("How should reply edit and delete behave?");
  await form.locator('input[name="solveIssue"]').uncheck();

  await submitAndWait(page, "Create Issue", ISSUE_URL);

  const replyForm = formFor(page, "Add response");
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
    test.setTimeout(120000);
    const reply = await createIssueWithReply(page, "Reply to delete", Date.now().toString());

    page.once("dialog", (dialog) => dialog.dismiss());
    await reply.getByRole("button", { name: "Delete" }).click();
    await expect(reply).toContainText("Reply to delete");

    page.once("dialog", (dialog) => dialog.accept());
    await reply.getByRole("button", { name: "Delete" }).click();
    await expect(reply).toHaveCount(0);
  });

  test("adds a video link without an error page", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");
    await form.locator('input[name="studentName"]').fill("E2E Link Student");
    await form.locator('input[name="studentEmail"]').fill(`e2e.links.${Date.now().toString()}@test.com`);
    await form.locator('input[name="title"]').fill("E2E reply links");
    await form.locator('textarea[name="question"]').fill("Links should not crash the reply form.");
    await form.locator('input[name="solveIssue"]').uncheck();

    await submitAndWait(page, "Create Issue", ISSUE_URL);

    const replyForm = formFor(page, "Add response");
    await replyForm.locator('textarea[name="body"]').fill("See the attached references.");
    await replyForm.getByText("Add screenshots or video links").click();
    await expect(replyForm.locator('textarea[name="fileLinks"]')).toHaveCount(0);
    await replyForm.locator('textarea[name="videoLinks"]').fill("Walkthrough|https://example.com/fix.mp4|01:20");
    await replyForm.getByRole("button", { name: "Add response" }).click();

    await expect(page.getByRole("heading", { name: "Something Went Wrong" })).toHaveCount(0);

    const reply = page.locator('[data-testid^="reply-"]').first();
    await expect(reply).toContainText("See the attached references.");
    await expect(reply.locator('a[href="https://example.com/fix.mp4"]')).toBeVisible();
  });
});
