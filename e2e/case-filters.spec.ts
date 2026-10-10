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

// The cases filter panel is collapsed by default; the arrow toggle reveals it.
// Locators are scoped to the visible panel: dev client-side navigation can leave
// a hidden duplicate of the previous route in the DOM while the router swaps it.
async function openFilters(page: Page) {
  const toggle = page.getByRole("button", { name: "Advanced filters" }).first();
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(page.locator('main select[name="status"]:visible')).toBeVisible();
}

// A filter navigation re-renders the panel, and React hydration can reset a
// select or input to its URL-backed defaultValue after it was set, so the next
// submit posts a stale or empty value. Re-fill and resubmit until the URL
// reflects the selection.
async function filterWith(page: Page, url: RegExp, fill: () => Promise<unknown>) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await fill();
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    const applied = await page
      .waitForURL(url, { timeout: 6_000 })
      .then(() => true)
      .catch(() => false);
    if (applied) return;
  }
  throw new Error(`Filter never applied (expected ${url})`);
}

async function createCase(
  page: Page,
  suffix: string,
  title: string,
  courseSlug: string,
  batchNo: string,
) {
  await page.goto("/dashboard/cases/new");
  await page.fill('input[name="studentName"]', "E2E Filter Student");
  await page.fill('input[name="studentEmail"]', `e2e.filter.${suffix}@test.com`);
  await page.fill('input[name="title"]', title);
  await page.fill('textarea[name="question"]', `Body for ${title}`);

  // Course slug and batch live inside a collapsed <details>.
  await page.locator("details").filter({ hasText: "Additional Details" }).locator("summary").click();
  await page.fill('input[name="courseSlug"]', courseSlug);
  await page.fill('input[name="batchNo"]', batchNo);

  await submit(page, /\/dashboard\/cases\/[a-f0-9]{24}$/);
}

const caseHeading = (page: Page, title: string) => page.getByRole("heading", { name: title });

test.describe("Case list filters (mentor)", () => {
  test("filters by course and batch", async ({ page }) => {
    const suffix = Date.now().toString();

    await createCase(page, suffix, "E2E filter react case", "react-beginner", "7");
    await createCase(page, suffix, "E2E filter python case", "python-basics", "9");

    await page.goto("/dashboard/cases");
    await openFilters(page);

    // The dropdowns are populated from values that actually exist on live cases.
    await expect(page.locator('select[name="courseSlug"] option[value="react-beginner"]')).toHaveCount(1);
    await expect(page.locator('select[name="batchNo"] option[value="7"]')).toHaveCount(1);

    await filterWith(page, /courseSlug=react-beginner/, () =>
      page.selectOption('main select[name="courseSlug"]:visible', "react-beginner"),
    );
    await expect(caseHeading(page, "E2E filter react case")).toBeVisible();
    await expect(caseHeading(page, "E2E filter python case")).toHaveCount(0);

    // Adding a batch that belongs to the other course must yield nothing.
    await filterWith(page, /batchNo=9/, () => page.selectOption('main select[name="batchNo"]:visible', "9"));
    await expect(caseHeading(page, "E2E filter react case")).toHaveCount(0);
    await expect(caseHeading(page, "E2E filter python case")).toHaveCount(0);

    // HeroUI renders its polymorphic Button as `<a role="button">`, so the
    // explicit ARIA role wins over the implicit link role.
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page).toHaveURL(/\/dashboard\/cases$/);
    await expect(caseHeading(page, "E2E filter react case")).toBeVisible();
    await expect(caseHeading(page, "E2E filter python case")).toBeVisible();
  });

  test("filters by mentor and date range", async ({ page }) => {
    const suffix = Date.now().toString();
    await createCase(page, suffix, "E2E filter mentor case", "react-beginner", "11");

    await page.goto("/dashboard/cases");
    await openFilters(page);

    // Cases created by this mentor default to mentorId = the signed-in mentor.
    await filterWith(
      page,
      /mentorId=[a-f0-9]{24}&from=2000-01-01&to=2999-12-31/,
      async () => {
        await page.selectOption('main select[name="mentorId"]:visible', { label: "Mentor User" });
        await page.fill('input[name="from"]', "2000-01-01");
        await page.fill('input[name="to"]', "2999-12-31");
      },
    );
    await expect(caseHeading(page, "E2E filter mentor case")).toBeVisible();

    // A date range that ends before the case was created must exclude it.
    await filterWith(page, /from=2000-01-01&to=2000-01-02/, async () => {
      await page.fill('input[name="from"]', "2000-01-01");
      await page.fill('input[name="to"]', "2000-01-02");
    });
    await expect(caseHeading(page, "E2E filter mentor case")).toHaveCount(0);
  });

  test("applies sort order", async ({ page }) => {
    await page.goto("/dashboard/cases");
    await openFilters(page);

    await filterWith(page, /sort=oldest/, () => page.selectOption('main select[name="sort"]:visible', "oldest"));
    await filterWith(page, /sort=priority/, () => page.selectOption('main select[name="sort"]:visible', "priority"));
  });
});
