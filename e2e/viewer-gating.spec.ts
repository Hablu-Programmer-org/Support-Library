import { test, expect } from "@playwright/test";

/**
 * VIEWER (students) must not see staff-only content: internal notes.
 * Data is prepared as ADMIN, then asserted as VIEWER.
 */
test.describe("VIEWER content gating", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("hides internal notes from students", async ({ page, browser }) => {
    const baseURL = test.info().project.use.baseURL as string;

    const publicReply = "E2E public step follows";
    const internalNote = "E2E internal archive note";
    const caseTitle = "E2E gating case";

    // Admin prepares a case with one public reply and one internal note.
    await page.goto("/dashboard/cases/new");
    await page.fill('input[name="studentName"]', "E2E Gating Student");
    await page.fill('input[name="studentEmail"]', `e2e.gating.${Date.now().toString()}@test.com`);
    await page.fill('input[name="title"]', caseTitle);
    await page.fill('textarea[name="question"]', "Which content may students see?");
    await Promise.all([
      page.waitForURL(/\/dashboard\/cases\/[a-f0-9]{24}$/),
      page.click('button[type="submit"]'),
    ]);
    const casePath = new URL(page.url()).pathname;

    const replyForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add Reply" }) });
    await replyForm.locator('textarea[name="body"]').fill(publicReply);
    await replyForm.getByRole("button", { name: "Add Reply" }).click();
    const noteForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add Internal Note" }) });
    await noteForm.locator('textarea[name="body"]').fill(internalNote);
    await noteForm.getByRole("button", { name: "Add Internal Note" }).click();

    // The viewer sees the case and its public reply, but never the internal note.
    const viewerContext = await browser.newContext({
      storageState: "e2e/.auth/viewer.json",
      baseURL,
    });
    const viewerPage = await viewerContext.newPage();
    await viewerPage.goto(casePath);

    await expect(viewerPage.getByRole("heading", { name: caseTitle })).toBeVisible();
    await expect(viewerPage.locator("article").filter({ hasText: publicReply })).toBeVisible();
    await expect(viewerPage.locator("article").filter({ hasText: internalNote })).toHaveCount(0);

    await viewerContext.close();
  });
});
