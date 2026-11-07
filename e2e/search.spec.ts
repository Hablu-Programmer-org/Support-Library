import { test, expect } from "@playwright/test";
import mongoose from "mongoose";

import { dbConnect } from "../lib/db";
import { SupportIssueModel } from "../models";
import { STAFF_USERS } from "./fixtures/staff-users";

/**
 * Keyword search over the issue list.
 *
 * The rows are seeded directly so every assertion has a unique token and cannot
 * depend on what earlier specs happened to create. `searchText` (staff) and
 * `publicSearchText` (student) are written explicitly, mirroring what the live
 * write path produces, so the tests exercise the query path rather than a form.
 */

const STUDENT = STAFF_USERS.find((user) => user.role === "STUDENT")!;
const STUDENT_ID = new mongoose.Types.ObjectId(STUDENT.id);

const token = `e2esearch${Date.now()}`;
const replyOnly = `replyonly${token}`;
const publicAnswer = `staffanswer${token}`;
const privateName = `zzzprivate${token}`;
const bengaliQuestion = "ছবি আপলোড হচ্ছে না";

const title = (label: string) => `E2E search ${label} ${token}`;

const heading = (page: import("@playwright/test").Page, label: string) =>
  page.getByRole("heading", { name: title(label) });

test.describe.configure({ timeout: 120_000 });

test.beforeAll(async () => {
  await dbConnect();
  await SupportIssueModel.insertMany([
    {
      title: title("alpha"),
      question: "Alpha question about a hydration mismatch.",
      // The reply marker is deliberately absent from the title/question.
      searchText: `${token} alpha hydration ${replyOnly}`,
      publicSearchText: `${token} alpha hydration ${replyOnly}`,
      createdBy: STUDENT_ID,
      status: "OPEN",
      visibility: "INTERNAL",
    },
    {
      title: `E2E SEARCH BETA ${token}`,
      question: "Beta question.",
      searchText: `e2e search beta ${token}`,
      publicSearchText: `e2e search beta ${token}`,
      createdBy: STUDENT_ID,
      status: "OPEN",
      visibility: "INTERNAL",
    },
    {
      title: title("bengali"),
      question: bengaliQuestion,
      searchText: `${token} ${bengaliQuestion}`,
      publicSearchText: `${token} ${bengaliQuestion}`,
      createdBy: STUDENT_ID,
      status: "OPEN",
      visibility: "INTERNAL",
    },
    {
      title: title("private"),
      question: "Only the staff scope may index private words.",
      searchText: `${token} studentprivatewords`,
      publicSearchText: `${token} only public body`,
      createdBy: STUDENT_ID,
      status: "OPEN",
      visibility: "INTERNAL",
    },
    {
      title: title("published"),
      question: "Published answer body.",
      studentName: privateName,
      searchText: `${token} ${privateName} ${publicAnswer}`,
      publicSearchText: `${token} ${publicAnswer}`,
      createdBy: STUDENT_ID,
      status: "SOLVED",
      visibility: "PUBLISHED",
      publishedAt: new Date(),
    },
  ]);
});

test.afterAll(async () => {
  await dbConnect();
  await SupportIssueModel.deleteMany({ title: { $regex: token } });
});

test.describe("Issue search (mentor)", () => {
  test.use({ storageState: "e2e/.auth/mentor.json" });

  test("finds text that exists only in the indexed body", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=${replyOnly}`);
    await expect(heading(page, "alpha")).toBeVisible();
  });

  test("matches case-insensitively and by substring", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=${encodeURIComponent(`e2e search beta ${token}`)}`);
    await expect(heading(page, "beta")).toBeVisible();
  });

  test("matches Bengali text", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=${encodeURIComponent("আপলোড")}`);
    await expect(heading(page, "bengali")).toBeVisible();
  });

  test("clearing the search restores the list immediately", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=${replyOnly}`);
    await expect(heading(page, "alpha")).toBeVisible();
    await expect(heading(page, "beta")).toHaveCount(0);

    await page.getByRole("button", { name: "Clear search" }).click();

    await expect(page).toHaveURL(/\/dashboard\/issues$/);
    await expect(heading(page, "beta")).toBeVisible();
  });

  test("defaults to relevance when a query is present", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=${token}`);
    await expect(heading(page, "alpha")).toBeVisible();
    // `relevance` is the default sort for a query, so the URL carries no
    // explicit `sort=` and the result line names the query.
    await expect(page).toHaveURL(new RegExp(`[?&]q=${encodeURIComponent(token)}(?:&|$)`));
    await expect(page.getByText(/results? for/)).toBeVisible();
  });

  test("deleting back to one character restores the list without a clear button", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=${replyOnly}`);
    await expect(heading(page, "alpha")).toBeVisible();
    await expect(heading(page, "beta")).toHaveCount(0);

    // A select-all + backspace empties the input; the deletion must navigate
    // immediately (not after a typing debounce), so the full list returns.
    const searchInput = page.locator('main input[name="q"]:visible');
    await searchInput.fill("a");
    await searchInput.press("Control+a");
    await searchInput.press("Backspace");

    await expect(page).toHaveURL(/\/dashboard\/issues$/);
    await expect(heading(page, "beta")).toBeVisible();
  });

  test("shows a recoverable empty state", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=${encodeURIComponent(`nomatch${token}`)}`);
    await expect(page.getByText(`No results for`, { exact: false })).toBeVisible();
    await expect(page.getByRole("link", { name: "Clear search" })).toBeVisible();
  });

  test("staff search covers reply-only content", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=studentprivatewords`);
    await expect(heading(page, "private")).toBeVisible();
  });
});

test.describe("Issue search (student)", () => {
  test.use({ storageState: "e2e/.auth/student.json" });

  test("finds a published issue by its staff answer", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=${publicAnswer}`);
    await expect(heading(page, "published")).toBeVisible();
  });

  test("does not expose the student's name through search", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=${privateName}`);
    await expect(page.getByText("No results for", { exact: false })).toBeVisible();
    await expect(heading(page, "published")).toHaveCount(0);
  });

  test("does not expose staff-only reply content", async ({ page }) => {
    await page.goto(`/dashboard/issues?q=studentprivatewords`);
    await expect(page.getByText("No results for", { exact: false })).toBeVisible();
  });
});
