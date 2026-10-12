import { test, expect } from "@playwright/test";

import { formFor, submitAndWait } from "./form-helpers";

/**
 * Reply mutation is author-scoped, with ADMIN as an override. This needs two
 * signed-in identities against the same issue, so the mentor gets its own context
 * instead of a per-describe `test.use`.
 */
test.describe("Reply edit/delete permissions", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("only the author or an admin sees edit and delete", async ({ page, browser }) => {
    test.setTimeout(120000);
    const baseURL = test.info().project.use.baseURL as string;

    await page.goto("/dashboard/issues/new");
    const form = formFor(page, "Create Issue");
    await form.locator('input[name="studentName"]').fill("E2E Perm Student");
    await form.locator('input[name="studentEmail"]').fill(`e2e.perm.${Date.now().toString()}@test.com`);
    await form.locator('input[name="title"]').fill("E2E permission issue");
    await form.locator('textarea[name="question"]').fill("Who may edit this reply?");
    await form.locator('input[name="solveIssue"]').uncheck();
    await submitAndWait(page, "Create Issue", /\/dashboard\/issues\/[a-f0-9]{24}$/);
    const issuePath = new URL(page.url()).pathname;

    // Admin authors a reply.
    const replyForm = formFor(page, "Add response");
    await replyForm.locator('textarea[name="body"]').fill("Admin authored reply");
    await replyForm.getByRole("button", { name: "Add response" }).click();

    const adminReply = page.locator("article").filter({ hasText: "Admin authored reply" });
    await expect(adminReply).toBeVisible();
    await expect(adminReply.getByRole("button", { name: "Edit", exact: true })).toBeVisible();
    await expect(adminReply.getByRole("button", { name: "Delete" })).toBeVisible();

    // The same mentor sees the reply but no edit/delete controls on it.
    const mentorContext = await browser.newContext({
      storageState: "e2e/.auth/mentor.json",
      baseURL,
    });
    const mentorPage = await mentorContext.newPage();
    await mentorPage.goto(issuePath);

    const mentorReply = mentorPage.locator('[data-testid^="reply-"]').filter({ hasText: "Admin authored reply" }).first();
    await expect(mentorReply).toBeVisible();
    await expect(mentorReply.getByRole("button", { name: "Edit", exact: true })).toHaveCount(0);
    await expect(mentorReply.getByRole("button", { name: "Delete" })).toHaveCount(0);

    await mentorContext.close();
  });
});
