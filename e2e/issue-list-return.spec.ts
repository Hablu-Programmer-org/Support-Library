import { test, expect, type Page } from "@playwright/test";
import mongoose from "mongoose";

import { dbConnect } from "../lib/db";
import { SupportIssueModel } from "../models";
import { STAFF_USERS } from "./fixtures/staff-users";

/**
 * Walking from a filtered page of results into a case must not lose the page.
 *
 * The list keeps its state in the URL; the detail page receives that URL as
 * `returnTo` and rebuilds it server-side. These specs pin the contract:
 *
 *  - the row link carries the list context,
 *  - "Back to results" restores filters *and* page,
 *  - archiving from the list stays on the page it was archived from,
 *  - a junk `?page=abc` renders the first page instead of failing the request.
 */

test.use({ storageState: "e2e/.auth/mentor.json" });

const STUDENT = STAFF_USERS.find((user) => user.role === "STUDENT")!;
const STUDENT_ID = new mongoose.Types.ObjectId(STUDENT.id);

/** 23 issues = 20 on page 1 and 3 on page 2, with the standard 20-row page size. */
const SEEDED_ISSUES = 23;
const PAGE_SIZE = 20;

const token = `e2ereturn${Date.now()}`;

test.describe.configure({ timeout: 120_000 });

test.beforeAll(async () => {
  await dbConnect();
  await SupportIssueModel.insertMany(
    Array.from({ length: SEEDED_ISSUES }, (_, index) => ({
      title: `E2E return ${token} #${index + 1}`,
      question: "Seeded to assert the list keeps its page when a case is opened.",
      searchText: `e2e return ${token} #${index + 1}`,
      createdBy: STUDENT_ID,
      status: "OPEN",
      priority: "NORMAL",
      visibility: "INTERNAL",
    })),
  );
});

test.afterAll(async () => {
  await dbConnect();
  await SupportIssueModel.deleteMany({ title: { $regex: token } });
});

const filteredUrl = (page?: number) =>
  `/dashboard/issues?q=${token}&sort=oldest${page ? `&page=${page}` : ""}`;

/** Rows are the only list links that carry the return context. */
const rowLinks = (page: Page) =>
  page.locator('main a[href*="returnTo="]:visible');

/** The pagination summary. Scoped to visible nodes: dev keeps stale routes in the DOM. */
const summary = (page: Page, text: string) =>
  page.locator("span:visible").filter({ hasText: text }).first();

test.describe("Issue list: returning from a case", () => {
  test("keeps filter and page when a case is opened and left again", async ({ page }) => {
    await page.goto(filteredUrl());

    await expect(summary(page, `Page 1 of 2 · Total ${SEEDED_ISSUES}`)).toBeVisible();
    await expect(rowLinks(page)).toHaveCount(PAGE_SIZE);

    await page.getByRole("link", { name: "Next" }).first().click();
    await expect(page).toHaveURL(new RegExp(`page=2$`));
    await expect(summary(page, `Page 2 of 2 · Total ${SEEDED_ISSUES}`)).toBeVisible();
    await expect(rowLinks(page)).toHaveCount(SEEDED_ISSUES - PAGE_SIZE);

    // The row link must carry the list URL, not a bare detail path.
    const rowHref = await rowLinks(page).first().getAttribute("href");
    expect(rowHref).toContain(`?returnTo=${encodeURIComponent(filteredUrl(2))}`);

    await rowLinks(page).first().click();
    // The list rows are h2; the case page's own title is the only h1.
    await expect(
      page.getByRole("heading", { level: 1, name: /E2E return/ }),
    ).toBeVisible();

    // The back link is the *result* page, not the bare list.
    await page.getByRole("link", { name: "Back to results" }).first().click();
    await expect(page).toHaveURL(new RegExp(`q=${token}&sort=oldest&page=2$`));
    await expect(summary(page, `Page 2 of 2 · Total ${SEEDED_ISSUES}`)).toBeVisible();
  });

  test("archiving from a filtered page stays on that page", async ({ page }) => {
    await page.goto(filteredUrl(2));

    const rows = rowLinks(page);
    await expect(rows).toHaveCount(SEEDED_ISSUES - PAGE_SIZE);

    page.on("dialog", (dialog) => dialog.accept());
    await page.locator('button[aria-label="Delete issue"]:visible').first().click();

    // 22 issues left: still two pages, and the viewer stays on page 2.
    await expect(page).toHaveURL(new RegExp(`q=${token}&sort=oldest&page=2$`));
    await expect(summary(page, `Page 2 of 2 · Total ${SEEDED_ISSUES - 1}`)).toBeVisible();
  });

  test("falls back to the first page for a non-numeric page", async ({ page }) => {
    const response = await page.goto("/dashboard/issues?page=abc");

    expect(response?.status()).toBe(200);
    await expect(page.getByText(/^Page 1 of \d+/).first()).toBeVisible();
  });

  test("redirects an out-of-range page to the last real page", async ({ page }) => {
    await page.goto(filteredUrl(999));

    // 22 issues after the archive test: 2 pages, so the viewer is clamped to page 2.
    await expect(page).toHaveURL(new RegExp(`q=${token}&sort=oldest&page=2$`));
    await expect(summary(page, `Page 2 of 2 · Total ${SEEDED_ISSUES - 1}`)).toBeVisible();
  });
});
