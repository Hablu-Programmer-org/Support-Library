import { test, expect, type Page } from "@playwright/test";

// This spec runs first alphabetically, so it has to create the data it asserts on.
test.describe.configure({ timeout: 120_000 });

const submit = async (page: Page, url: RegExp) => {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const navigated = page
      .waitForURL(url, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    await page.click('button[type="submit"]');
    if (await navigated) return;
  }
  throw new Error(`Submit never navigated to ${url}`);
};

async function seedCaseWithCourseAndBatch(page: Page) {
  const suffix = Date.now().toString();

  await page.goto("/dashboard/students/new");
  await page.fill('input[name="name"]', "E2E Analytics Student");
  await page.fill('input[name="studentId"]', `e2e-analytics-${suffix}`);
  await page.fill('input[name="email"]', `e2e.analytics.${suffix}@test.com`);
  await submit(page, /\/dashboard\/students\/[a-f0-9]{24}$/);
  const studentMongoId = page.url().split("/").pop()!;

  await page.goto(`/dashboard/cases/new?studentId=${studentMongoId}`);
  await page.selectOption('select[name="studentRefId"]', studentMongoId);
  await page.fill('input[name="title"]', "E2E analytics case");
  await page.fill('textarea[name="question"]', "Workload breakdown please");
  await page.locator("details").filter({ hasText: "অপশনাল তথ্য" }).locator("summary").click();
  await page.fill('input[name="courseSlug"]', "react-analytics");
  await page.fill('input[name="batchNo"]', "42");
  await submit(page, /\/dashboard\/cases\/[a-f0-9]{24}$/);

  // A reply gives the mentor activity a non-zero reply count.
  const replyForm = page.locator("form").filter({
    has: page.getByRole("button", { name: "উত্তর যোগ করুন" }),
  });
  await replyForm.locator('textarea[name="body"]').fill("Checked the bundle output");
  await replyForm.getByRole("button", { name: "উত্তর যোগ করুন" }).click();
}

test.describe("Analytics", () => {
  test("mentor sees workload breakdowns", async ({ browser }) => {
    const baseURL = test.info().project.use.baseURL as string;
    const context = await browser.newContext({
      storageState: "e2e/.auth/mentor.json",
      baseURL,
    });
    const page = await context.newPage();

    await seedCaseWithCourseAndBatch(page);

    await page.goto("/dashboard/analytics");
    await expect(page.getByRole("heading", { name: "অ্যানালিটিক্স" })).toBeVisible();

    await expect(page.getByText("গত ৭ দিনে নতুন কেস")).toBeVisible();
    await expect(page.getByText("Course অনুযায়ী কেস")).toBeVisible();
    await expect(page.getByText("Batch অনুযায়ী কেস")).toBeVisible();
    await expect(page.getByText("Mentor Activity")).toBeVisible();

    // The seeded course and batch appear in the breakdowns.
    await expect(page.getByText("react-analytics")).toBeVisible();
    await expect(page.getByText("Batch 42")).toBeVisible();

    // The mentor workload table is present with its columns.
    await expect(page.getByRole("columnheader", { name: "Assigned" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Unresolved" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Replies" })).toBeVisible();

    await context.close();
  });

  test("viewer is redirected away from analytics", async ({ browser }) => {
    const baseURL = test.info().project.use.baseURL as string;
    const context = await browser.newContext({
      storageState: "e2e/.auth/viewer.json",
      baseURL,
    });
    const page = await context.newPage();

    await page.goto("/dashboard/analytics");
    await expect(page).toHaveURL(/\/unauthorized/);
    await expect(page.getByText("Course অনুযায়ী কেস")).toHaveCount(0);

    await context.close();
  });
});