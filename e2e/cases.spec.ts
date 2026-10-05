import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/mentor.json" });

test.describe("Case CRUD (mentor)", () => {
  test("creates a student, case, replies, and updates status", async ({ page }) => {
    const suffix = Date.now().toString();
    const studentId = `e2e-student-${suffix}`;

    await page.goto("/dashboard/students/new");
    await page.fill('input[name="name"]', "E2E Test Student");
    await page.fill('input[name="studentId"]', studentId);
    await page.fill('input[name="email"]', `e2e.student.${suffix}@test.com`);
    await Promise.all([
      page.waitForURL(/\/dashboard\/students\/[a-f0-9]{24}$/),
      page.click('button[type="submit"]'),
    ]);
    const studentMongoId = page.url().split("/").pop()!;

    await page.goto(`/dashboard/cases/new?studentId=${studentMongoId}`);
    await page.selectOption('select[name="studentRefId"]', studentMongoId);
    await page.fill('input[name="title"]', "E2E React image not rendering");
    await page.fill('textarea[name="question"]', "Image show hocche na in React component");
    await page.selectOption('select[name="status"]', "OPEN");
    await Promise.all([
      page.waitForURL(/\/dashboard\/cases\/[a-f0-9]{24}$/),
      page.click('button[type="submit"]'),
    ]);
    await expect(page.getByText("E2E React image not rendering")).toBeVisible();
    await expect(page.locator("p").filter({ hasText: "Image show hocche na in React component" }).first()).toBeVisible();

    const replyForm = page.locator("form").filter({ has: page.getByRole("button", { name: "উত্তর যোগ করুন" }) });
    await replyForm.locator('textarea[name="body"]').fill("Use public folder with /image.png");
    await replyForm.getByRole("button", { name: "উত্তর যোগ করুন" }).click();
    await expect(page.locator("article").filter({ hasText: "Use public folder with /image.png" })).toBeVisible();

    const noteForm = page.locator("form").filter({ has: page.getByRole("button", { name: "নোট যোগ করুন" }) });
    await noteForm.locator('textarea[name="body"]').fill("Internal: student needs follow-up");
    await noteForm.getByRole("button", { name: "নোট যোগ করুন" }).click();
    await expect(page.locator("article").filter({ hasText: "Internal: student needs follow-up" })).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "Internal Note" })).toBeVisible();

    const statusForm = page.locator("form").filter({ has: page.getByRole("button", { name: "আপডেট" }) }).first();
    await statusForm.locator('select[name="status"]').selectOption("SOLVED");
    await statusForm.getByRole("button", { name: "আপডেট" }).click();
    await expect(page.locator("span").filter({ hasText: /^সলভড$/ }).first()).toBeVisible();
  });
});
