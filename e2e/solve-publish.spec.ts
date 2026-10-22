import { test, expect, type Page } from "@playwright/test";

import { formFor, submitAndWait } from "./form-helpers";

test.use({ storageState: "e2e/.auth/admin.json" });

const ISSUE_URL = /\/dashboard\/issues\/[a-f0-9]{24}$/;

const submitCreate = (page: Page) => submitAndWait(page, "Create Issue", ISSUE_URL);

test.describe("Admin solving publishes", () => {
  test("marking SOLVED with the short PII confirmation publishes and can be removed", async ({ page }) => {
    const title = `E2E solve publishes ${Date.now()}`;

    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");
    await form.locator('input[name="studentName"]').fill("E2E Solve Student");
    await form.locator('input[name="studentEmail"]').fill(`e2e.solve.${Date.now()}@test.com`);
    await form.locator('input[name="title"]').fill(title);
    await form.locator('textarea[name="question"]').fill("Publishing should follow a solve.");
    // Keep the new case OPEN: the create form's "solved" option is not a publish.
    await form.locator('input[name="solveIssue"]').uncheck();
    await submitCreate(page);
    await expect(page.locator("span").filter({ hasText: /^Open$/ }).first()).toBeVisible();
    await expect(page.getByText("Student Library", { exact: true })).toHaveCount(0);

    const statusForm = page.locator("form").filter({ has: page.locator("#issue-status") }).first();
    await statusForm.locator('select[name="status"]').selectOption("SOLVED");

    // Publication still needs the short PII review, so solving does not submit
    // until the admin ticks it.
    const confirmation = statusForm.getByRole("checkbox", {
      name: /no student personal information in this issue/i,
    });
    await expect(confirmation).toBeVisible();
    await expect(page.getByText("Student Library", { exact: true })).toHaveCount(0);
    await confirmation.check();
    await statusForm.getByRole("button", { name: "Save and publish" }).click();

    await expect.poll(() => page.getByText("Student Library", { exact: true }).isVisible()).toBeTruthy();
    await expect(page.locator("span").filter({ hasText: /^Solved$/ }).first()).toBeVisible();

    // Removing it again stays one click, exactly like a manually published issue.
    await page.getByRole("button", { name: "Remove from library" }).click();
    await expect.poll(() => page.getByText("Student Library", { exact: true }).count()).toBe(0);
    await expect(page.locator("span").filter({ hasText: /^Solved$/ }).first()).toBeVisible();
  });
});
