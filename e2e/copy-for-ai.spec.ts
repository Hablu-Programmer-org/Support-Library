import { expect, test } from "@playwright/test";

import { formFor, submitAndWait } from "./form-helpers";

/**
 * "Copy for AI" is an admin-only affordance on an internal issue. It must copy
 * the issue context without student PII, and must never appear for mentors or
 * students — even on a published issue they may read.
 */
test.describe("Copy for AI prompt", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("admin copies a PII-free prompt; mentor and student never see the button", async ({
    page,
    context,
    browser,
  }) => {
    test.setTimeout(120_000);
    const baseURL = test.info().project.use.baseURL as string;
    const stamp = Date.now();
    const title = `E2E copy for AI ${stamp}`;
    const question = "My production webhook keeps returning 404 after activation even though the workflow is saved.";
    const studentName = "E2E Copy Student";
    const studentEmail = `e2e.copy.${stamp}@test.com`;

    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");
    await form.locator('input[name="studentName"]').fill(studentName);
    await form.locator('input[name="studentEmail"]').fill(studentEmail);
    await form.locator('input[name="title"]').fill(title);
    await form.locator('textarea[name="question"]').fill(question);
    await form.locator('input[name="solveIssue"]').uncheck();
    await submitAndWait(page, "Create Issue", /\/dashboard\/issues\/[a-f0-9]{24}$/);
    const issuePath = new URL(page.url()).pathname;

    await expect(page.getByRole("button", { name: "Copy for AI" })).toBeVisible();
    await page.getByRole("button", { name: "Copy for AI" }).click();
    await expect(page.getByText("Copied for AI")).toBeVisible();

    const copied = await page.evaluate(() => navigator.clipboard.readText());

    expect(copied).toContain(title);
    expect(copied).toContain(question);
    expect(copied).toContain("Status: Open");
    expect(copied).toContain("untrusted support-case data");
    expect(copied).toContain("Write the final answer in Bengali");
    // This case has no uploads; the attachment flow is covered by the unit
    // tests, so assert the explicit "nothing attached" wording instead.
    expect(copied).toContain("No screenshots or attachments are associated with this issue.");

    // No student identity, internal reference or private attachment data.
    expect(copied).not.toContain(studentEmail);
    expect(copied).not.toContain(studentName);
    expect(copied).not.toMatch(/https?:\/\//);
    expect(copied).not.toContain(issuePath);

    // Mentors can open the same case but may not hand it to an AI.
    const mentorContext = await browser.newContext({
      storageState: "e2e/.auth/mentor.json",
      baseURL,
    });
    const mentorPage = await mentorContext.newPage();
    await mentorPage.goto(issuePath);
    await expect(mentorPage.getByRole("heading", { name: title })).toBeVisible();
    await expect(mentorPage.getByRole("button", { name: "Copy for AI" })).toHaveCount(0);
    await mentorContext.close();

    // A published issue is readable by students, but the prompt stays internal.
    await page.getByRole("checkbox", { name: /student personal information/i }).check();
    await page.getByRole("button", { name: "Publish to library" }).click();
    await expect
      .poll(() => page.getByText("Student Library", { exact: true }).isVisible())
      .toBeTruthy();

    const studentContext = await browser.newContext({
      storageState: "e2e/.auth/student.json",
      baseURL,
    });
    const studentPage = await studentContext.newPage();
    await studentPage.goto(issuePath);
    await expect(studentPage.getByRole("heading", { name: title })).toBeVisible();
    await expect(studentPage.getByRole("button", { name: "Copy for AI" })).toHaveCount(0);
    await studentContext.close();
  });
});
