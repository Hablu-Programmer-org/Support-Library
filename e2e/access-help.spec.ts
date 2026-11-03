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
    await expect(card.getByText("n8n: 1 year · OpenAI: 2 months")).toBeVisible();
    await expect(card.getByText("Select the access you need.")).toBeVisible();
    await expect(card.getByText(/No API key is emailed/i)).toHaveCount(0);

    // Desktop layout: options and the send button share one row.
    const optionTops = await card.locator('label:has(input[name="requestTypes"])').evaluateAll((labels) =>
      labels.map((label) => Math.round(label.getBoundingClientRect().top)),
    );
    const buttonTop = await card
      .getByRole("button", { name: "Send selected requests" })
      .evaluate((button) => Math.round(button.getBoundingClientRect().top));
    expect(new Set([...optionTops, buttonTop]).size).toBe(1);

    // The message stays on a single line on desktop.
    const messageWhiteSpace = await card
      .getByText("Select the access you need.")
      .evaluate((element) => getComputedStyle(element).whiteSpace);
    expect(messageWhiteSpace).toBe("nowrap");

    // Mobile wraps instead of overflowing.
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
  });
});

test.describe("access request administration", () => {
  test("allows admins and denies mentors", async ({ browser }) => {
    const admin = await browser.newContext({ storageState: "e2e/.auth/admin.json" });
    const adminPage = await admin.newPage();
    await adminPage.goto("/dashboard/access-requests");
    await expect(adminPage.getByRole("heading", { name: "Access requests" })).toBeVisible();

    // Two tabs, each carrying its own pending count. Sent rows are hidden until
    // the admin asks for them.
    const openAiTab = adminPage.getByRole("button", { name: /^OpenAI/ });
    const n8nTab = adminPage.getByRole("button", { name: /^n8n/ });
    await expect(openAiTab).toHaveAttribute("aria-pressed", "true");
    await expect(openAiTab).toContainText("0 pending");
    await expect(n8nTab).toContainText("0 pending");
    await expect(adminPage.getByRole("checkbox", { name: "Show already sent" })).not.toBeChecked();
    await expect(adminPage.getByRole("region", { name: "OpenAI API access" })).toBeVisible();

    await adminPage.getByText("Create requests manually", { exact: true }).click();
    await adminPage.getByLabel("Student email", { exact: true }).fill("e2e.lms.student@test.com");
    await adminPage.getByRole("checkbox", { name: "n8n access" }).check();
    await adminPage.getByRole("checkbox", { name: "OpenAI API access" }).check();
    await adminPage.getByRole("button", { name: "Create selected requests" }).click();
    await expect(adminPage.getByRole("status")).toContainText("2 request(s) created");

    // The OpenAI tab is open by default and shows only its own request.
    const openAiQueue = adminPage.getByRole("region", { name: "OpenAI API access" });
    await expect(openAiTab).toContainText("1 pending");
    await expect(n8nTab).toContainText("1 pending");
    await expect(openAiQueue.getByText("Admin created")).toHaveCount(1);
    await expect(openAiQueue.getByRole("button", { name: /Copy e2e\.lms\.student@test\.com/i })).toBeVisible();
    await expect(openAiQueue.getByRole("button", { name: "Confirm invite & email student" })).toBeVisible();
    await expect(adminPage.locator('input[name="link"]')).toHaveCount(0);

    // The n8n tab keeps both n8n request types and the link form.
    await n8nTab.click();
    await expect(n8nTab).toHaveAttribute("aria-pressed", "true");
    const n8nQueue = adminPage.getByRole("region", { name: "n8n access & password reset" });
    await expect(n8nQueue.getByText("Admin created")).toHaveCount(1);
    await expect(adminPage.locator('input[name="link"]')).toHaveCount(1);

    // Email search is server-side and live: no submit button, and it survives a
    // refresh because the query lives in the URL.
    const search = adminPage.getByRole("searchbox", { name: "Search by student email" });
    await search.fill("e2e.lms.student@test.com");
    await expect(adminPage).toHaveURL(/q=e2e\.lms\.student%40test\.com/);
    await expect(n8nQueue.getByText("Admin created")).toBeVisible();
    await search.fill("nobody@test.com");
    await expect(n8nQueue.getByText(/No pending n8n requests match/)).toBeVisible();
    await adminPage.getByRole("button", { name: "Clear email search" }).click();
    await expect(n8nQueue.getByText("Admin created")).toBeVisible();

    // The sent toggle changes the query without hiding pending work.
    await adminPage.getByRole("checkbox", { name: "Show already sent" }).check();
    await expect(adminPage).toHaveURL(/sent=1/);
    await expect(n8nQueue.getByText("Admin created")).toBeVisible();

    await adminPage.setViewportSize({ width: 390, height: 844 });
    expect(await adminPage.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);
    await admin.close();

    const mentor = await browser.newContext({ storageState: "e2e/.auth/mentor.json" });
    const mentorPage = await mentor.newPage();
    await mentorPage.goto("/dashboard/access-requests");
    await expect(mentorPage).toHaveURL(/\/unauthorized$/);
    await mentor.close();
  });
});
