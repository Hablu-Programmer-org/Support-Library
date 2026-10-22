import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { test, expect } from "@playwright/test";

import { formFor, submitAndWait } from "./form-helpers";

/**
 * The reply composer reports its failures in the form.
 *
 * Every one of these used to throw out of the server action, which replaced the
 * whole case page with "Something Went Wrong" and threw away the response the
 * mentor had just written: a rejected attachment (the real reason was hidden by
 * the error boundary), a stale CSRF token, and a reused operation id.
 */
test.use({ storageState: "e2e/.auth/mentor.json" });

const ISSUE_URL = /\/dashboard\/issues\/[a-f0-9]{24}$/;

async function createIssue(page: import("@playwright/test").Page, tag: string) {
  await page.goto("/dashboard/issues/new");
  const form = formFor(page, "Create Issue");
  await form.locator('input[name="studentName"]').fill("E2E Reply Error Student");
  await form.locator('input[name="studentEmail"]').fill(`e2e.replyerr.${tag}@test.com`);
  await form.locator('input[name="title"]').fill(`E2E reply errors ${tag}`);
  await form.locator('textarea[name="question"]').fill("How does the reply composer report failures?");
  await form.locator('input[name="solveIssue"]').uncheck();
  await submitAndWait(page, "Create Issue", ISSUE_URL);
}

test.describe("Reply composer failure reporting", () => {
  test("a rejected attachment shows the reason and keeps the typed response", async ({ page }) => {
    test.setTimeout(120000);
    await createIssue(page, `upload-${Date.now()}`);

    const filePath = join(process.cwd(), "test-results", "reply-not-an-image.txt");
    writeFileSync(filePath, "this is not an image");

    const replyForm = formFor(page, "Add response");
    await replyForm.locator('textarea[name="body"]').fill("Reply with a bad attachment");
    await replyForm.getByText("Add attachments or video links").click();
    await replyForm.locator('input[type="file"]').setInputFiles(filePath);
    await replyForm.getByRole("button", { name: "Add response" }).click();

    await expect(page.getByRole("alert").filter({ hasText: /not a supported image/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Something Went Wrong" })).toHaveCount(0);
    // The half-written response survives the failure.
    await expect(formFor(page, "Add response").locator('textarea[name="body"]')).toHaveValue(
      "Reply with a bad attachment",
    );
  });

  test("a stale CSRF token asks for a reload instead of crashing the page", async ({ page }) => {
    test.setTimeout(120000);
    await createIssue(page, `csrf-${Date.now()}`);

    const replyForm = formFor(page, "Add response");
    await replyForm.locator('textarea[name="body"]').fill("Reply with a stale token");
    await replyForm.locator('input[name="csrfToken"]').evaluate((input) => {
      (input as HTMLInputElement).value = "v1.1.1.deadbeef.invalid";
    });
    await replyForm.getByRole("button", { name: "Add response" }).click();

    await expect(page.getByRole("alert").filter({ hasText: /session expired/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Something Went Wrong" })).toHaveCount(0);
    await expect(formFor(page, "Add response").locator('textarea[name="body"]')).toHaveValue(
      "Reply with a stale token",
    );
  });

  test("two responses written on the same page view both save", async ({ page }) => {
    test.setTimeout(120000);
    const tag = `two-${Date.now()}`;
    await createIssue(page, tag);

    const firstForm = formFor(page, "Add response");
    await firstForm.locator('textarea[name="body"]').fill("First response body");
    await firstForm.getByRole("button", { name: "Add response" }).click();
    await expect(
      page.locator('[data-testid^="reply-"]').filter({ hasText: "First response body" }),
    ).toBeVisible();

    // No reload: the composer regenerates the operation id for the new text.
    const secondForm = formFor(page, "Add response");
    await secondForm.locator('textarea[name="body"]').fill("Second response body");
    await secondForm.getByRole("button", { name: "Add response" }).click();

    await expect(
      page.locator('[data-testid^="reply-"]').filter({ hasText: "Second response body" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Something Went Wrong" })).toHaveCount(0);
  });
});
