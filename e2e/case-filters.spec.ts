import { test, expect, type Page } from "@playwright/test";

test.use({ storageState: "e2e/.auth/mentor.json" });

// This spec runs first alphabetically, so its first page views pay a cold dev
// compile. A click that lands before React hydrates falls back to a native form
// post and silently stays on the same URL, so retry the submit until it routes.
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

async function createStudent(page: Page, suffix: string) {
  await page.goto("/dashboard/students/new");
  await page.fill('input[name="name"]', "E2E Filter Student");
  await page.fill('input[name="studentId"]', `e2e-filter-${suffix}`);
  await page.fill('input[name="email"]', `e2e.filter.${suffix}@test.com`);
  await submit(page, /\/dashboard\/students\/[a-f0-9]{24}$/);
  return page.url().split("/").pop()!;
}

async function createCase(
  page: Page,
  studentMongoId: string,
  title: string,
  courseSlug: string,
  batchNo: string,
) {
  await page.goto(`/dashboard/cases/new?studentId=${studentMongoId}`);
  await page.selectOption('select[name="studentRefId"]', studentMongoId);
  await page.fill('input[name="title"]', title);
  await page.fill('textarea[name="question"]', `Body for ${title}`);

  // Course slug and batch live inside a collapsed <details>.
  await page.locator("details").filter({ hasText: "অপশনাল তথ্য" }).locator("summary").click();
  await page.fill('input[name="courseSlug"]', courseSlug);
  await page.fill('input[name="batchNo"]', batchNo);

  await submit(page, /\/dashboard\/cases\/[a-f0-9]{24}$/);
}

const caseHeading = (page: Page, title: string) => page.getByRole("heading", { name: title });

test.describe("Case list filters (mentor)", () => {
  test("filters by course and batch", async ({ page }) => {
    const suffix = Date.now().toString();
    const studentMongoId = await createStudent(page, suffix);

    await createCase(page, studentMongoId, "E2E filter react case", "react-beginner", "7");
    await createCase(page, studentMongoId, "E2E filter python case", "python-basics", "9");

    await page.goto("/dashboard/cases");

    // The dropdowns are populated from values that actually exist on live cases.
    await expect(page.locator('select[name="courseSlug"] option[value="react-beginner"]')).toHaveCount(1);
    await expect(page.locator('select[name="batchNo"] option[value="7"]')).toHaveCount(1);

    await page.selectOption('select[name="courseSlug"]', "react-beginner");
    await page.getByRole("button", { name: "ফিল্টার" }).click();
    await expect(page).toHaveURL(/courseSlug=react-beginner/);
    await expect(caseHeading(page, "E2E filter react case")).toBeVisible();
    await expect(caseHeading(page, "E2E filter python case")).toHaveCount(0);

    // Adding a batch that belongs to the other course must yield nothing.
    await page.selectOption('select[name="batchNo"]', "9");
    await page.getByRole("button", { name: "ফিল্টার" }).click();
    await expect(page).toHaveURL(/batchNo=9/);
    await expect(caseHeading(page, "E2E filter react case")).toHaveCount(0);
    await expect(caseHeading(page, "E2E filter python case")).toHaveCount(0);

    // HeroUI renders its polymorphic Button as `<a role="button">`, so the
    // explicit ARIA role wins over the implicit link role.
    await page.getByRole("button", { name: "রিসেট" }).click();
    await expect(page).toHaveURL(/\/dashboard\/cases$/);
    await expect(caseHeading(page, "E2E filter react case")).toBeVisible();
    await expect(caseHeading(page, "E2E filter python case")).toBeVisible();
  });

  test("filters by mentor and date range", async ({ page }) => {
    const suffix = Date.now().toString();
    const studentMongoId = await createStudent(page, suffix);
    await createCase(page, studentMongoId, "E2E filter mentor case", "react-beginner", "11");

    await page.goto("/dashboard/cases");

    // Cases created by this mentor default to mentorId = the signed-in mentor.
    await page.selectOption('select[name="mentorId"]', { label: "Mentor User" });
    await page.fill('input[name="from"]', "2000-01-01");
    await page.fill('input[name="to"]', "2999-12-31");
    await page.getByRole("button", { name: "ফিল্টার" }).click();

    await expect(page).toHaveURL(/mentorId=[a-f0-9]{24}/);
    await expect(page).toHaveURL(/from=2000-01-01/);
    await expect(page).toHaveURL(/to=2999-12-31/);
    await expect(caseHeading(page, "E2E filter mentor case")).toBeVisible();

    // A date range that ends before the case was created must exclude it.
    await page.fill('input[name="from"]', "2000-01-01");
    await page.fill('input[name="to"]', "2000-01-02");
    await page.getByRole("button", { name: "ফিল্টার" }).click();
    await expect(caseHeading(page, "E2E filter mentor case")).toHaveCount(0);
  });
});