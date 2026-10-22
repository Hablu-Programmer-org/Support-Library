import { test, expect } from "@playwright/test";

import { formFor, submitAndWait } from "./form-helpers";

/**
 * STUDENT (students) must only see published issues, and never student PII.
 * Data is prepared as ADMIN, then asserted as STUDENT.
 */
test.describe("STUDENT content gating", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("hides unpublished issues and student PII from students", async ({ page, browser }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    const baseURL = test.info().project.use.baseURL as string;

    const publicReply = "E2E public step follows";
    const issueTitle = "E2E gating issue";
    const studentEmail = `e2e.gating.${Date.now().toString()}@test.com`;

    // Admin prepares an issue with one public reply.
    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");
    await form.locator('input[name="studentName"]').fill("E2E Gating Student");
    await form.locator('input[name="studentEmail"]').fill(studentEmail);
    await form.locator('input[name="title"]').fill(issueTitle);
    await form.locator('textarea[name="question"]').fill("Which content may students see?");
    await form.locator('input[name="solveIssue"]').uncheck();

    await submitAndWait(page, "Create Issue", /\/dashboard\/issues\/[a-f0-9]{24}$/);
    const issuePath = new URL(page.url()).pathname;

    const replyForm = formFor(page, "Add response");
    await replyForm.locator('textarea[name="body"]').fill(publicReply);
    await replyForm.getByRole("button", { name: "Add response" }).click();
    await expect(page.locator("article").filter({ hasText: publicReply }).first()).toBeVisible();

    const studentContext = await browser.newContext({
      storageState: "e2e/.auth/student.json",
      baseURL,
    });
    const studentPage = await studentContext.newPage();
    await studentPage.goto(issuePath);
    await expect(studentPage.getByRole("heading", { name: "404" })).toBeVisible();

    await page.getByRole("button", { name: "Publish to library" }).click();
    await expect(
      page.getByRole("alert").filter({
        hasText: "Confirm this issue has no student personal information",
      }),
    ).toBeVisible();
    await expect(page.getByText("Student Library", { exact: true })).toHaveCount(0);

    await page.getByRole("checkbox", { name: /student personal information/i }).check();
    await page.getByRole("button", { name: "Publish to library" }).click();
    await expect(page).toHaveURL(/\/dashboard\/issues\/[a-f0-9]{24}$/);
    await expect.poll(() => page.getByText("Student Library", { exact: true }).isVisible()).toBeTruthy();

    // The student sees the issue and its public reply, but never student PII.
    await studentPage.goto(issuePath);

    await expect(studentPage.getByRole("heading", { name: issueTitle })).toBeVisible();
    await expect(studentPage.locator("article").filter({ hasText: publicReply }).first()).toBeVisible();
    await expect(studentPage.getByText("E2E Gating Student")).toHaveCount(0);
    await expect(studentPage.getByText(studentEmail)).toHaveCount(0);

    // A student may read a published issue but must never get staff controls.
    for (const control of [
      "Add response",
      "Publish to library",
      "Remove from library",
      "Update status",
    ]) {
      await expect(studentPage.getByRole("button", { name: control })).toHaveCount(0);
    }
    await expect(studentPage.getByRole("link", { name: /edit issue details/i })).toHaveCount(0);

    await studentPage.goto("/dashboard/issues");
    await expect(studentPage.getByRole("heading", { name: issueTitle })).toBeVisible();
    await expect(studentPage.getByText("E2E Gating Student")).toHaveCount(0);
    await expect(studentPage.getByText(studentEmail)).toHaveCount(0);

    await page.getByRole("button", { name: "Remove from library" }).click();
    await expect(page.getByText("Student Library", { exact: true })).toHaveCount(0);
    await studentPage.goto(issuePath);
    await expect(studentPage.getByRole("heading", { name: "404" })).toBeVisible();

    await page.getByRole("checkbox", { name: /student personal information/i }).check();
    await page.getByRole("button", { name: "Publish to library" }).click();
    await expect.poll(() => page.getByText("Student Library", { exact: true }).isVisible()).toBeTruthy();

    await replyForm.locator('textarea[name="body"]').fill("E2E changed after publication");
    await replyForm.getByRole("button", { name: "Add response" }).click();
    await expect(page.getByText("Student Library", { exact: true })).toHaveCount(0);
    await studentPage.goto(issuePath);
    await expect(studentPage.getByRole("heading", { name: "404" })).toBeVisible();
    expect(pageErrors).toEqual([]);

    await studentContext.close();
  });
});
