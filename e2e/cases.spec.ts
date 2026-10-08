import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/mentor.json" });

test.describe("Case CRUD (mentor)", () => {
  test("creates a case, replies, and updates status", async ({ page }) => {
    await page.goto("/dashboard/cases/new");
    await page.fill('input[name="studentName"]', "E2E Test Student");
    await page.fill('input[name="studentEmail"]', `e2e.student.${Date.now().toString()}@test.com`);
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

    // Edit controls are author-scoped: this mentor owns the reply added above.
    const reply = page.locator("article").filter({ hasText: "Use public folder with /image.png" });
    await reply.getByRole("button", { name: "এডিট" }).click();

    // While editing, the body paragraph is replaced by the editor, so anchor the
    // editor on its own label rather than on the old body text.
    const editor = page.locator("article").filter({ hasText: "উত্তর সম্পাদনা" });
    await editor.locator('textarea[name="body"]').fill("Edited: use /public/image.png");
    await editor.getByRole("button", { name: "সংরক্ষণ" }).click();

    await expect(
      page.locator("article").filter({ hasText: "Edited: use /public/image.png" }),
    ).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "Use public folder with /image.png" })).toHaveCount(0);
    await expect(page.locator("article").filter({ hasText: "edited" }).first()).toBeVisible();
  });

  test("autofills student name from an LMS email match", async ({ page }) => {
    await page.goto("/dashboard/cases/new");

    await page.fill('input[name="studentEmail"]', "e2e.lms.student@test.com");
    await expect(page.locator('input[name="studentName"]')).toHaveValue("E2E LMS Student");
    await expect(page.getByText("LMS-এ আছে")).toBeVisible();

    // A manual name edit must not be clobbered by a later lookup.
    await page.fill('input[name="studentName"]', "Manual Name");
    await page.fill('input[name="studentEmail"]', "some.other.member@test.com");
    await expect(page.getByText("LMS-এ পাওয়া যায়নি")).toBeVisible();
    await expect(page.locator('input[name="studentName"]')).toHaveValue("Manual Name");
  });
});