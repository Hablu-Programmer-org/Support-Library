import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/mentor.json" });

test.describe("Issue CRUD (mentor)", () => {
  for (const scenario of [
    { label: "text and attachments", body: "Use the documented fix for the image path.", solved: true },
    { label: "attachments only", body: "", solved: true },
    { label: "answer awaiting confirmation", body: "Please try the attached fix and confirm.", solved: false },
  ]) {
    test(`creates an issue with ${scenario.label} in one submission`, async ({ page }) => {
      await page.goto("/dashboard/issues/new");
      await page.fill('input[name="studentName"]', "E2E Answer Student");
      await page.fill('input[name="studentEmail"]', `e2e.answer.${Date.now()}@test.com`);
      await page.fill('input[name="title"]', `E2E ${scenario.label}`);
      await page.fill('textarea[name="question"]', "How do I fix the broken image path?");
      await page.locator("summary").filter({ hasText: "Answer (Optional)" }).click();
      await page.fill('textarea[name="solutionBody"]', scenario.body);
      await page.fill('textarea[name="solutionFileLinks"]', "Guide|https://example.com/fix.pdf|pdf\nScreenshot|https://example.com/fix.png|image");
      await page.fill('textarea[name="solutionVideoLinks"]', "Walkthrough|https://example.com/fix.mp4|01:20");
      await expect(page.locator('input[name="solveIssue"]')).toBeChecked();
      if (!scenario.solved) await page.locator('input[name="solveIssue"]').uncheck();
      await Promise.all([
        page.waitForURL(/\/dashboard\/issues\/[a-f0-9]{24}$/),
        page.getByRole("button", { name: "Create Issue", exact: true }).click(),
      ]);
      await expect(page.locator("article")).toHaveCount(1);
      const reply = page.locator("article");
      if (scenario.body) await expect(reply).toContainText(scenario.body);
      await expect(reply.locator('a[href="https://example.com/fix.pdf"]')).toBeVisible();
      await expect(reply.locator('a[href="https://example.com/fix.png"]')).toBeVisible();
      await expect(reply.locator('a[href="https://example.com/fix.mp4"]')).toBeVisible();
      await expect(page.locator("span").filter({ hasText: scenario.solved ? /^Solved$/ : /^Open$/ }).first()).toBeVisible();
    });
  }

  test("creates an issue, replies, and updates status", async ({ page }) => {
    await page.goto("/dashboard/issues/new");
    await page.fill('input[name="studentName"]', "E2E Test Student");
    await page.fill('input[name="studentEmail"]', `e2e.student.${Date.now().toString()}@test.com`);
    await page.fill('input[name="title"]', "E2E React image not rendering");
    await page.fill('textarea[name="question"]', "Image show hocche na in React component");
    await expect(page.locator('select[name="status"]')).toHaveCount(0);
    await Promise.all([
      page.waitForURL(/\/dashboard\/issues\/[a-f0-9]{24}$/),
      page.click('button[type="submit"]'),
    ]);
    await expect(page.getByText("E2E React image not rendering")).toBeVisible();
    await expect(page.locator("span").filter({ hasText: /^Open$/ }).first()).toBeVisible();
    await expect(page.locator("p").filter({ hasText: "Image show hocche na in React component" }).first()).toBeVisible();

    const replyForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add Reply" }) });
    await replyForm.locator('textarea[name="body"]').fill("Use public folder with /image.png");
    await replyForm.getByRole("button", { name: "Add Reply" }).click();
    await expect(page.locator("article").filter({ hasText: "Use public folder with /image.png" })).toBeVisible();

    const noteForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Add Internal Note" }) });
    await noteForm.locator('textarea[name="body"]').fill("Internal: student needs follow-up");
    await noteForm.getByRole("button", { name: "Add Internal Note" }).click();
    await expect(page.locator("article").filter({ hasText: "Internal: student needs follow-up" })).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "Internal Note" })).toBeVisible();

    const statusForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Update", exact: true }) }).first();
    await statusForm.locator('select[name="status"]').selectOption("SOLVED");
    await statusForm.getByRole("button", { name: "Update", exact: true }).click();
    await expect(page.locator("span").filter({ hasText: /^Solved$/ }).first()).toBeVisible();

    // Edit controls are author-scoped: this mentor owns the reply added above.
    const reply = page.locator("article").filter({ hasText: "Use public folder with /image.png" });
    await reply.getByRole("button", { name: "Edit", exact: true }).click();

    // While editing, the body paragraph is replaced by the editor, so anchor the
    // editor on the reply article itself rather than on the old body text.
    const editor = reply;
    await editor.locator('textarea[name="body"]').fill("Edited: use /public/image.png");
    await editor.getByRole("button", { name: "Save" }).click();

    await expect(
      page.locator("article").filter({ hasText: "Edited: use /public/image.png" }),
    ).toBeVisible();
    await expect(page.locator("article").filter({ hasText: "Use public folder with /image.png" })).toHaveCount(0);
    await expect(page.locator("article").filter({ hasText: "edited" }).first()).toBeVisible();
  });

  test("autofills student name from an LMS email match", async ({ page }) => {
    await page.goto("/dashboard/issues/new");

    await page.fill('input[name="studentEmail"]', "e2e.lms.student@test.com");
    await expect(page.locator('input[name="studentName"]')).toHaveValue("E2E LMS Student");
    await expect(page.getByText("Found in LMS")).toBeVisible();

    await expect(page.locator('input[name="studentName"]')).toBeHidden();
    await page.fill('input[name="studentEmail"]', "some.other.member@test.com");
    await expect(page.getByText("No matching LMS user found.", { exact: false })).toBeVisible();
    await page.fill('input[name="studentName"]', "Manual Name");
    await page.fill('input[name="studentEmail"]', "e2e.lms.student@test.com");
    await expect(page.getByText("Found in LMS")).toBeVisible();
    await expect(page.locator('input[name="studentName"]')).toHaveValue("Manual Name");
  });
});