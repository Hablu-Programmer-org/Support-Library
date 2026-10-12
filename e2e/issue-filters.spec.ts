import { test, expect, type Page } from "@playwright/test";

import { formFor } from "./form-helpers";

test.use({ storageState: "e2e/.auth/mentor.json" });

// This spec runs first alphabetically, so its first page views pay a cold
// compile. A click that lands before React hydrates falls back to a native form
// post and silently stays on the same URL, so retry the submit until it routes.
test.describe.configure({ timeout: 120_000 });

const submit = async (page: Page, url: RegExp) => {
  const form = formFor(page, "Create Issue");
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const navigated = page
      .waitForURL(url, { timeout: 10_000 })
      .then(() => true)
      .catch(() => false);
    await form.getByRole("button", { name: "Create Issue", exact: true }).click();
    if (await navigated) return;
  }
  throw new Error(`Submit never navigated to ${url}`);
};

// The issues filter panel is collapsed by default; the arrow toggle reveals it.
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

async function createIssue(
  page: Page,
  suffix: string,
  title: string,
  courseSlug: string,
  batchNo: string,
) {
  await page.goto("/dashboard/issues/new");
  const form = formFor(page, "Create Issue");
  await form.locator('input[name="studentName"]').fill("E2E Filter Student");
  await form.locator('input[name="studentEmail"]').fill(`e2e.filter.${suffix}@test.com`);
  await form.locator('input[name="title"]').fill(title);
  await form.locator('textarea[name="question"]').fill(`Body for ${title}`);

  // Course slug and batch live inside a collapsed <details>.
  await form.locator("details").filter({ hasText: "Additional Details" }).locator("summary").click();
  await form.locator('input[name="courseSlug"]').fill(courseSlug);
  await form.locator('input[name="batchNo"]').fill(batchNo);

  await form.locator('input[name="solveIssue"]').uncheck();
  await submit(page, /\/dashboard\/issues\/[a-f0-9]{24}$/);
}

const issueHeading = (page: Page, title: string) => page.getByRole("heading", { name: title });

test.describe("Issue list filters (mentor)", () => {
  test("filters by course and batch", async ({ page }) => {
    const suffix = Date.now().toString();

    await createIssue(page, suffix, "E2E filter react issue", "react-beginner", "7");
    await createIssue(page, suffix, "E2E filter python issue", "python-basics", "9");

    await page.goto("/dashboard/issues");
    await openFilters(page);

    // The dropdowns are populated from values that actually exist on live issues.
    await expect(page.locator('select[name="courseSlug"] option[value="react-beginner"]')).toHaveCount(1);
    await expect(page.locator('select[name="batchNo"] option[value="7"]')).toHaveCount(1);

    await filterWith(page, /courseSlug=react-beginner/, () =>
      page.selectOption('main select[name="courseSlug"]:visible', "react-beginner"),
    );
    await expect(issueHeading(page, "E2E filter react issue")).toBeVisible();
    await expect(issueHeading(page, "E2E filter python issue")).toHaveCount(0);

    // Adding a batch that belongs to the other course must yield nothing.
    await filterWith(page, /batchNo=9/, () => page.selectOption('main select[name="batchNo"]:visible', "9"));
    await expect(issueHeading(page, "E2E filter react issue")).toHaveCount(0);
    await expect(issueHeading(page, "E2E filter python issue")).toHaveCount(0);

    // HeroUI renders its polymorphic Button as `<a role="button">`, so the
    // explicit ARIA role wins over the implicit link role.
    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page).toHaveURL(/\/dashboard\/issues$/);
    await expect(issueHeading(page, "E2E filter react issue")).toBeVisible();
    await expect(issueHeading(page, "E2E filter python issue")).toBeVisible();
  });

  test("filters by mentor and date range", async ({ page }) => {
    const suffix = Date.now().toString();
    await createIssue(page, suffix, "E2E filter mentor issue", "react-beginner", "11");

    await page.goto("/dashboard/issues");
    await openFilters(page);

    // Issues created by this mentor default to mentorId = the signed-in mentor.
    await filterWith(
      page,
      /mentorId=[a-f0-9]{24}&from=2000-01-01&to=2999-12-31/,
      async () => {
        await page.selectOption('main select[name="mentorId"]:visible', { label: "Mentor User" });
        await page.locator('main input[name="from"]:visible').fill("2000-01-01");
        await page.locator('main input[name="to"]:visible').fill("2999-12-31");
      },
    );
    await expect(issueHeading(page, "E2E filter mentor issue")).toBeVisible();

    // A date range that ends before the issue was created must exclude it.
    await filterWith(page, /from=2000-01-01&to=2000-01-02/, async () => {
      await page.locator('main input[name="from"]:visible').fill("2000-01-01");
      await page.locator('main input[name="to"]:visible').fill("2000-01-02");
    });
    await expect(issueHeading(page, "E2E filter mentor issue")).toHaveCount(0);
  });

  test("applies sort order", async ({ page }) => {
    await page.goto("/dashboard/issues");
    await openFilters(page);

    await filterWith(page, /sort=oldest/, () => page.selectOption('main select[name="sort"]:visible', "oldest"));
    await filterWith(page, /sort=priority/, () => page.selectOption('main select[name="sort"]:visible', "priority"));
  });
});