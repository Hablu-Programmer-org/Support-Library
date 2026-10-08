import { test, expect, type Page } from "@playwright/test";

/**
 * VIEWER (students) must not see staff-only content: internal notes and
 * INTERNAL solutions. Data is prepared as ADMIN, then asserted as VIEWER.
 */
test.describe("VIEWER content gating", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("hides internal notes and INTERNAL solutions from students", async ({ page, browser }) => {
    const baseURL = test.info().project.use.baseURL as string;

    const publicReply = "E2E public step follows";
    const internalNote = "E2E internal archive note";
    const caseTitle = "E2E gating case";
    const internalSolution = "E2E INTERNAL hook memo";
    const publicSolution = "E2E PUBLIC hook memo";

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

    const replyForm = page.locator("form").filter({ has: page.getByRole("button", { name: "উত্তর যোগ করুন" }) });
    await replyForm.locator('textarea[name="body"]').fill(publicReply);
    await replyForm.getByRole("button", { name: "উত্তর যোগ করুন" }).click();
    const noteForm = page.locator("form").filter({ has: page.getByRole("button", { name: "নোট যোগ করুন" }) });
    await noteForm.locator('textarea[name="body"]').fill(internalNote);
    await noteForm.getByRole("button", { name: "নোট যোগ করুন" }).click();

    const createSolution = async (title: string, visibility: string) => {
      await page.goto("/dashboard/solutions/new");
      await page.fill('input[name="title"]', title);
      await page.fill('textarea[name="summary"]', `Summary for ${title}`);
      await page.fill('textarea[name="body"]', `Body for ${title}`);
      await page.selectOption('select[name="visibility"]', visibility);
      await Promise.all([
        page.waitForURL(/\/dashboard\/solutions\/(?!new$)[^/]+$/),
        page.click('button[type="submit"]'),
      ]);
      return new URL(page.url()).pathname;
    };

    const internalPath = await createSolution(internalSolution, "INTERNAL");
    await createSolution(publicSolution, "PUBLIC");

    // Link both solutions to the case.
    await page.goto(casePath);
    const link = page.locator('select[name="solutionArticleId"]');
    await link.selectOption({ label: publicSolution });
    await page.getByRole("button", { name: "Link", exact: true }).click();
    await expect(page.getByRole("link", { name: publicSolution })).toBeVisible();

    await link.selectOption({ label: internalSolution });
    await page.getByRole("button", { name: "Link", exact: true }).click();
    await expect(page.getByRole("link", { name: internalSolution })).toBeVisible();

    // The viewer sees the case, its public reply and the PUBLIC solution, but
    // never the internal note or the INTERNAL solution.
    const viewerContext = await browser.newContext({
      storageState: "e2e/.auth/viewer.json",
      baseURL,
    });
    const viewerPage = await viewerContext.newPage();
    await viewerPage.goto(casePath);

    await expect(viewerPage.getByRole("heading", { name: caseTitle })).toBeVisible();
    await expect(viewerPage.locator("article").filter({ hasText: publicReply })).toBeVisible();
    await expect(viewerPage.locator("article").filter({ hasText: internalNote })).toHaveCount(0);
    await expect(viewerPage.getByRole("link", { name: publicSolution })).toBeVisible();
    await expect(viewerPage.getByRole("link", { name: internalSolution })).toHaveCount(0);

    // The solutions library only lists PUBLIC entries for the viewer.
    await viewerPage.goto("/dashboard/solutions");
    await expect(viewerPage.getByRole("heading", { name: publicSolution })).toBeVisible();
    await expect(viewerPage.getByRole("heading", { name: internalSolution })).toHaveCount(0);

    // A direct slug URL to an INTERNAL solution must 404 for the viewer.
    await viewerPage.goto(internalPath);
    await expect(viewerPage.getByRole("heading", { name: "৪০৪" })).toBeVisible();

    await viewerContext.close();
  });
});