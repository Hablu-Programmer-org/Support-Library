import { test, expect, type Page } from "@playwright/test";

import { fillMarkdownEditor, formFor, submitAndWait } from "./form-helpers";

test.use({ storageState: "e2e/.auth/admin.json" });

const ISSUE_URL = /\/dashboard\/issues\/\d{6}$/;

const submitCreate = (page: Page) => submitAndWait(page, "Create Issue", ISSUE_URL);

test.describe("Admin solving and publishing", () => {
  test("marking SOLVED only changes status; publishing is the single publish form", async ({ page }) => {
    const title = `E2E solve publishes ${Date.now()}`;

    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");
    await form.locator('input[name="studentName"]').fill("E2E Solve Student");
    await form.locator('input[name="studentEmail"]').fill(`e2e.solve.${Date.now()}@test.com`);
    await form.locator('input[name="title"]').fill(title);
    await fillMarkdownEditor(form, "Issue details", "question", "Publishing should happen only after the issue is solved and the PII review is confirmed.");
    // Keep the new case OPEN: the create form's "solved" option is not a publish.
    await form.locator('input[name="solveIssue"]').uncheck();
    await submitCreate(page);
    await expect(page.locator("span").filter({ hasText: /^Open$/ }).first()).toBeVisible();
    await expect(page.getByText("Student Library", { exact: true })).toHaveCount(0);

    const statusForm = page.locator("form").filter({ has: page.locator("#issue-status") }).first();
    await statusForm.locator('select[name="status"]').selectOption("SOLVED");

    // Solving saves the status and never publishes, and the PII review appears once.
    await expect(page.locator("span").filter({ hasText: /^Solved$/ }).first()).toBeVisible();
    await expect(page.getByText("Student Library", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: /no student personal information in this issue/i })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "Save and publish" })).toHaveCount(0);

    await page.getByRole("checkbox", { name: /no student personal information in this issue/i }).check();
    await page.getByRole("button", { name: "Publish to library" }).click();
    await expect.poll(() => page.getByText("Student Library", { exact: true }).isVisible()).toBeTruthy();

    await page.getByRole("button", { name: "Remove from library" }).click();
    await expect.poll(() => page.getByText("Student Library", { exact: true }).count()).toBe(0);
    await expect(page.locator("span").filter({ hasText: /^Solved$/ }).first()).toBeVisible();
  });
});
