import { test, expect } from "@playwright/test";

import { fillMarkdownEditor, formFor, submitAndWait } from "./form-helpers";

test.use({ storageState: "e2e/.auth/mentor.json" });

const ISSUE_URL = /\/dashboard\/issues\/[a-f0-9]{24}$/;

async function createIssueWithReply(page: import("@playwright/test").Page, body: string, emailTag: string) {
  await page.goto("/dashboard/issues/new");
  const form = formFor(page, "Create Issue");
  await form.locator('input[name="studentName"]').fill("E2E Edit Delete Student");
  await form.locator('input[name="studentEmail"]').fill(`e2e.editdel.${emailTag}@test.com`);
  await form.locator('input[name="title"]').fill(`E2E edit/delete ${emailTag}`);
  await fillMarkdownEditor(form, "Issue details", "question", "How should reply editing and deletion behave after a staff response has been saved?");
  await form.locator('input[name="solveIssue"]').uncheck();

  await submitAndWait(page, "Create Issue", ISSUE_URL);

  const replyForm = formFor(page, "Add response");
  await fillMarkdownEditor(replyForm, "Response", "body", body);
  await replyForm.getByRole("button", { name: "Add response" }).click();

  const reply = page.locator('[data-testid^="reply-"]');
  await expect(reply).toContainText(body);
  return reply;
}

test.describe("Reply edit and delete interactions", () => {
  test("cancel keeps the body and save closes the editor", async ({ page }) => {
    const reply = await createIssueWithReply(page, "Original reply body", Date.now().toString());

    await reply.getByRole("button", { name: "Edit", exact: true }).click();
    const editor = reply.getByRole("textbox", { name: "Edit reply", exact: true });
    await expect(editor).toBeVisible();

    await editor.fill("Never saved");
    await reply.getByRole("button", { name: "Cancel" }).click();
    // Unsaved changes ask first instead of disappearing.
    await expect(reply.getByText("Discard your changes?")).toBeVisible();
    await reply.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(reply.getByRole("textbox", { name: "Edit reply", exact: true })).toHaveCount(0);
    await expect(reply).toContainText("Original reply body");
    await expect(reply).not.toContainText("Never saved");

    await reply.getByRole("button", { name: "Edit", exact: true }).click();
    await fillMarkdownEditor(reply, "Edit reply", "body", "Updated reply body");
    await reply.getByRole("button", { name: "Save" }).click();
    await expect(reply.getByRole("textbox", { name: "Edit reply", exact: true })).toHaveCount(0);
    await expect(reply).toContainText("Updated reply body");
    await expect(reply).not.toContainText("Original reply body");
    await expect(reply).toContainText("edited");
  });

  test("editing a reply adds a link through the body, with no separate video-link field", async ({ page }) => {
    const reply = await createIssueWithReply(page, "Reply with a walkthrough", Date.now().toString());

    await reply.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(reply.locator('[name="videoLinks"]')).toHaveCount(0);
    await fillMarkdownEditor(reply, "Edit reply", "body", "Walkthrough: https://youtu.be/e2e-demo");
    await reply.getByRole("button", { name: "Save" }).click();

    await expect(reply.locator('a[href="https://youtu.be/e2e-demo"]')).toBeVisible();
  });

  test("delete only removes the reply after confirming", async ({ page }) => {
    test.setTimeout(120000);
    const reply = await createIssueWithReply(page, "Reply to delete", Date.now().toString());

    await reply.getByRole("button", { name: "Delete", exact: true }).click();
    await reply.getByRole("button", { name: "Keep reply" }).click();
    await expect(reply).toContainText("Reply to delete");

    await reply.getByRole("button", { name: "Delete", exact: true }).click();
    await reply.getByRole("button", { name: "Delete reply" }).click();
    await expect(reply).toHaveCount(0);
  });

  test("adds a link in a response without an error page", async ({ page }) => {
    test.setTimeout(120000);
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");
    await form.locator('input[name="studentName"]').fill("E2E Link Student");
    await form.locator('input[name="studentEmail"]').fill(`e2e.links.${Date.now().toString()}@test.com`);
    await form.locator('input[name="title"]').fill("E2E reply links");
    await fillMarkdownEditor(form, "Issue details", "question", "Adding a valid link should save normally and must not crash the reply form.");
    await form.locator('input[name="solveIssue"]').uncheck();

    await submitAndWait(page, "Create Issue", ISSUE_URL);

    const replyForm = formFor(page, "Add response");
    await fillMarkdownEditor(replyForm, "Response", "body", "See the attached references. https://example.com/fix.mp4");
    await replyForm.getByText("Add attachments").click();
    await expect(replyForm.locator('textarea[name="fileLinks"]')).toHaveCount(0);
    await expect(replyForm.locator('[name="videoLinks"]')).toHaveCount(0);
    await replyForm.getByRole("button", { name: "Add response" }).click();

    await expect(page.getByRole("heading", { name: "Something Went Wrong" })).toHaveCount(0);

    const reply = page.locator('[data-testid^="reply-"]').first();
    await expect(reply).toContainText("See the attached references.");
    await expect(reply.locator('a[href="https://example.com/fix.mp4"]')).toBeVisible();
  });
});
