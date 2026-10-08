import { test, expect } from "@playwright/test";

test.use({ storageState: "e2e/.auth/mentor.json" });

test.describe("Solution CRUD (mentor)", () => {
  test("creates an INTERNAL solution and shows linked case state", async ({ page }) => {
    const suffix = Date.now().toString();
    const title = `E2E React useEffect loop fix ${suffix}`;

    await page.goto("/dashboard/solutions/new");
    await page.fill('input[name="title"]', title);
    await page.fill('textarea[name="summary"]', "Dependency array issue causes infinite loop");
    await page.fill('textarea[name="body"]', "Move unstable object/function dependencies out of render or memoize where needed.");
    await page.fill('input[name="tags"]', "react, useeffect, hooks");
    await Promise.all([
      page.waitForURL(/\/dashboard\/solutions\/(?!new$)[^/]+$/),
      page.click('button[type="submit"]'),
    ]);
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText("INTERNAL", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("এই solution এখনো কোনো case-এর সাথে linked না।")).toBeVisible();
  });

  test("prefills a draft solution from a case and its latest public reply", async ({ page }) => {
    const suffix = Date.now().toString();
    const caseTitle = `E2E prefilled case ${suffix}`;
    const answer = `E2E suggested fix ${suffix}`;

    await page.goto("/dashboard/cases/new");
    await page.fill('input[name="studentName"]', "E2E Prefill Student");
    await page.fill('input[name="studentEmail"]', `e2e.prefill.${suffix}@test.com`);
    await page.fill('input[name="title"]', caseTitle);
    await page.fill('textarea[name="question"]', `E2E question ${suffix}`);
    await page.locator("details").filter({ hasText: "অপশনাল তথ্য" }).locator("summary").click();
    await page.fill('input[name="tags"]', "react, prefill");
    await Promise.all([
      page.waitForURL(/\/dashboard\/cases\/[a-f0-9]{24}$/),
      page.click('button[type="submit"]'),
    ]);
    const caseId = page.url().split("/").pop()!;

    const replyForm = page.locator("form").filter({
      has: page.getByRole("button", { name: "উত্তর যোগ করুন" }),
    });
    await replyForm.locator('textarea[name="body"]').fill(answer);
    await replyForm.getByRole("button", { name: "উত্তর যোগ করুন" }).click();
    await expect(page.getByText(answer)).toBeVisible();

    // HeroUI renders the polymorphic Button as `<a role="button">`.
    await page.getByRole("button", { name: "এই কেস থেকে সলিউশন বানান" }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/solutions/new\\?fromCase=${caseId}`));
    await expect(page.getByTestId("solution-prefill-banner")).toContainText(caseTitle);

    // Title, summary, body and tags are all seeded from the case + reply.
    await expect(page.locator('input[name="title"]')).toHaveValue(`Fix: ${caseTitle}`);
    await expect(page.locator('textarea[name="summary"]')).toHaveValue(`E2E question ${suffix}`);
    // Exact body structure is covered by __tests__/solution-prefill.test.ts;
// here we only care that the case and reply were wired into the draft.
    // toHaveValue normalizes whitespace on a textarea, so read the raw value.
    const body = await page.locator('textarea[name="body"]').inputValue();
    expect(body).toContain(`## Problem\nE2E question ${suffix}`);
    expect(body).toContain(`## Suggested fix\n${answer}`);
    expect(body).toContain("## Steps");
    await expect(page.locator('input[name="tags"]')).toHaveValue("react, prefill");

    // A mentor cannot publish, so the draft stays INTERNAL.
    await expect(page.locator('select[name="visibility"]')).toBeDisabled();
  });
});
