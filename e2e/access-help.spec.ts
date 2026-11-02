import { expect, test } from "@playwright/test";

test.describe("student access help", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("shows n8n and OpenAI tabs directly below issue search", async ({ page }) => {
    await page.goto("/dashboard/issues");
    const search = page.getByPlaceholder(/Search by problem/);
    const card = page.getByRole("region", { name: "Help & access" });
    await expect(search).toBeVisible();
    await expect(card).toBeVisible();
    expect(await search.evaluate((element) => element.compareDocumentPosition(document.querySelector('[aria-labelledby="access-help-heading"]')!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();

    await expect(card.getByRole("group", { name: "Choose n8n help" })).toBeVisible();
    await card.getByRole("tab", { name: "OpenAI API access" }).click();
    await expect(card.getByLabel("What do you want to build?")).toBeVisible();
    await expect(card.getByText(/API keys are never sent by email/i)).toBeVisible();
  });
});

test.describe("access request administration", () => {
  test("allows admins and denies mentors", async ({ browser }) => {
    const admin = await browser.newContext({ storageState: "e2e/.auth/admin.json" });
    const adminPage = await admin.newPage();
    await adminPage.goto("/dashboard/access-requests");
    await expect(adminPage.getByRole("heading", { name: "Access requests" })).toBeVisible();
    await admin.close();

    const mentor = await browser.newContext({ storageState: "e2e/.auth/mentor.json" });
    const mentorPage = await mentor.newPage();
    await mentorPage.goto("/dashboard/access-requests");
    await expect(mentorPage).toHaveURL(/\/unauthorized$/);
    await mentor.close();
  });
});
