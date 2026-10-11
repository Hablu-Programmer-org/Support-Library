import { test, expect } from "@playwright/test";

/**
 * VIEWER (students) must only see published issues, and never student PII.
 * Data is prepared as ADMIN, then asserted as VIEWER.
 */
test.describe("VIEWER content gating", () => {
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
    await page.fill('input[name="studentName"]', "E2E Gating Student");
    await page.fill('input[name="studentEmail"]', studentEmail);
    await page.fill('input[name="title"]', issueTitle);
    await page.fill('textarea[name="question"]', "Which content may students see?");
    await page.uncheck('input[name="solveIssue"]');
    await Promise.all([
      page.waitForURL(/\/dashboard\/issues\/[a-f0-9]{24}$/),
      page.getByRole("button", { name: "Create Issue", exact: true }).click(),
    ]);
    const issuePath = new URL(page.url()).pathname;

    const replyForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add response" }) });
    await replyForm.locator('textarea[name="body"]').fill(publicReply);
    await replyForm.getByRole("button", { name: "Add response" }).click();
    await expect(page.locator("article").filter({ hasText: publicReply })).toBeVisible();

    const viewerContext = await browser.newContext({
      storageState: "e2e/.auth/viewer.json",
      baseURL,
    });
    const viewerPage = await viewerContext.newPage();
    await viewerPage.goto(issuePath);
    await expect(viewerPage.getByRole("heading", { name: "404" })).toBeVisible();

    await page.getByRole("button", { name: "Publish to library" }).click();
    await expect(
      page.getByRole("alert").filter({
        hasText: "Please confirm you have reviewed the issue for student personal information",
      }),
    ).toBeVisible();
    await expect(page.getByText("Student Library", { exact: true })).toHaveCount(0);

    await page.getByRole("checkbox", { name: /reviewed this issue/ }).check();
    await page.getByRole("button", { name: "Publish to library" }).click();
    await expect(page).toHaveURL(/\/dashboard\/issues\/[a-f0-9]{24}$/);
    await expect.poll(() => page.getByText("Student Library", { exact: true }).isVisible()).toBeTruthy();

    // The viewer sees the issue and its public reply, but never student PII.
    await viewerPage.goto(issuePath);

    await expect(viewerPage.getByRole("heading", { name: issueTitle })).toBeVisible();
    await expect(viewerPage.locator("article").filter({ hasText: publicReply })).toBeVisible();
    await expect(viewerPage.getByText("E2E Gating Student")).toHaveCount(0);
    await expect(viewerPage.getByText(studentEmail)).toHaveCount(0);

    await viewerPage.goto("/dashboard/issues");
    await expect(viewerPage.getByRole("heading", { name: issueTitle })).toBeVisible();
    await expect(viewerPage.getByText("E2E Gating Student")).toHaveCount(0);
    await expect(viewerPage.getByText(studentEmail)).toHaveCount(0);

    await page.getByRole("button", { name: "Remove from library" }).click();
    await expect(page.getByText("Student Library", { exact: true })).toHaveCount(0);
    await viewerPage.goto(issuePath);
    await expect(viewerPage.getByRole("heading", { name: "404" })).toBeVisible();

    await page.getByRole("checkbox", { name: /reviewed this issue/ }).check();
    await page.getByRole("button", { name: "Publish to library" }).click();
    await expect.poll(() => page.getByText("Student Library", { exact: true }).isVisible()).toBeTruthy();

    await replyForm.locator('textarea[name="body"]').fill("E2E changed after publication");
    await replyForm.getByRole("button", { name: "Add response" }).click();
    await expect(page.getByText("Student Library", { exact: true })).toHaveCount(0);
    await viewerPage.goto(issuePath);
    await expect(viewerPage.getByRole("heading", { name: "404" })).toBeVisible();
    expect(pageErrors).toEqual([]);

    await viewerContext.close();
  });
});
