import { expect, test } from "@playwright/test";

test.describe("student access help", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("shows all access choices directly below issue search", async ({ page }) => {
    await page.goto("/dashboard/issues");
    const search = page.getByPlaceholder(/Search by problem/);
    const card = page.getByRole("region", { name: "Help & access" });
    await expect(search).toBeVisible();
    await expect(card).toBeVisible();
    expect(await search.evaluate((element) => element.compareDocumentPosition(document.querySelector('[aria-labelledby="access-help-heading"]')!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();

    await expect(card.getByRole("group", { name: "Choose access requests" })).toBeVisible();
    await expect(card.getByRole("checkbox", { name: /n8n access/i })).toBeVisible();
    await expect(card.getByRole("checkbox", { name: /n8n password reset/i })).toBeVisible();
    await expect(card.getByRole("checkbox", { name: /OpenAI API access/i })).toBeVisible();
    await expect(card.getByText(/No API key is emailed/i)).toBeVisible();
  });
});

test.describe("access request administration", () => {
  test("allows admins and denies mentors", async ({ browser }) => {
    const admin = await browser.newContext({ storageState: "e2e/.auth/admin.json" });
    const adminPage = await admin.newPage();
    await adminPage.goto("/dashboard/access-requests");
    await expect(adminPage.getByRole("heading", { name: "Access requests" })).toBeVisible();
    // OpenAI and n8n are separate, clearly labelled queues.
    await expect(adminPage.getByRole("heading", { name: "OpenAI API access" })).toBeVisible();
    await expect(adminPage.getByRole("heading", { name: "n8n access & password reset" })).toBeVisible();

    await adminPage.getByLabel("Student email").fill("e2e.lms.student@test.com");
    await adminPage.getByRole("checkbox", { name: "n8n access" }).check();
    await adminPage.getByRole("checkbox", { name: "OpenAI API access" }).check();
    await adminPage.getByRole("button", { name: "Create selected requests" }).click();
    await expect(adminPage.getByRole("status")).toContainText("2 request(s) created");
    await expect(adminPage.getByText("Created by admin", { exact: false })).toHaveCount(2);

    // The OpenAI path needs no link: copy the email, add it in OpenAI, then confirm.
    const openAiQueue = adminPage.getByRole("region", { name: "OpenAI API access" });
    await expect(openAiQueue.getByRole("button", { name: /Copy e2e\.lms\.student@test\.com/i })).toBeVisible();
    await expect(openAiQueue.getByRole("button", { name: "Confirm added & email student" })).toBeVisible();
    // Only the n8n queue asks for a link.
    await expect(adminPage.locator('input[name="link"]')).toHaveCount(1);
    await admin.close();

    const mentor = await browser.newContext({ storageState: "e2e/.auth/mentor.json" });
    const mentorPage = await mentor.newPage();
    await mentorPage.goto("/dashboard/access-requests");
    await expect(mentorPage).toHaveURL(/\/unauthorized$/);
    await mentor.close();
  });
});
