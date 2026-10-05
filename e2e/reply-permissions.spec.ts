import { test, expect } from "@playwright/test";

/**
 * Reply mutation is author-scoped, with ADMIN as an override. This needs two
 * signed-in identities against the same case, so the mentor gets its own context
 * instead of a per-describe `test.use`.
 */
test.describe("Reply edit/delete permissions", () => {
  test.use({ storageState: "e2e/.auth/admin.json" });

  test("only the author or an admin sees edit and delete", async ({ page, browser }) => {
    const baseURL = test.info().project.use.baseURL as string;
    const suffix = Date.now().toString();

    await page.goto("/dashboard/students/new");
    await page.fill('input[name="name"]', "E2E Perm Student");
    await page.fill('input[name="studentId"]', `e2e-perm-${suffix}`);
    await page.fill('input[name="email"]', `e2e.perm.${suffix}@test.com`);
    await Promise.all([
      page.waitForURL(/\/dashboard\/students\/[a-f0-9]{24}$/),
      page.click('button[type="submit"]'),
    ]);
    const studentMongoId = page.url().split("/").pop()!;

    await page.goto(`/dashboard/cases/new?studentId=${studentMongoId}`);
    await page.selectOption('select[name="studentRefId"]', studentMongoId);
    await page.fill('input[name="title"]', "E2E permission case");
    await page.fill('textarea[name="question"]', "Who may edit this reply?");
    await Promise.all([
      page.waitForURL(/\/dashboard\/cases\/[a-f0-9]{24}$/),
      page.click('button[type="submit"]'),
    ]);
    const casePath = new URL(page.url()).pathname;

    // Admin authors a reply.
    const replyForm = page.locator("form").filter({ has: page.getByRole("button", { name: "উত্তর যোগ করুন" }) });
    await replyForm.locator('textarea[name="body"]').fill("Admin authored reply");
    await replyForm.getByRole("button", { name: "উত্তর যোগ করুন" }).click();

    const adminReply = page.locator("article").filter({ hasText: "Admin authored reply" });
    await expect(adminReply).toBeVisible();
    await expect(adminReply.getByRole("button", { name: "এডিট" })).toBeVisible();
    await expect(adminReply.getByRole("button", { name: "মুছুন" })).toBeVisible();

    // The same mentor sees the reply but no edit/delete controls on it.
    const mentorContext = await browser.newContext({
      storageState: "e2e/.auth/mentor.json",
      baseURL,
    });
    const mentorPage = await mentorContext.newPage();
    await mentorPage.goto(casePath);

    const mentorReply = mentorPage.locator("article").filter({ hasText: "Admin authored reply" });
    await expect(mentorReply).toBeVisible();
    await expect(mentorReply.getByRole("button", { name: "এডিট" })).toHaveCount(0);
    await expect(mentorReply.getByRole("button", { name: "মুছুন" })).toHaveCount(0);

    await mentorContext.close();
  });
});