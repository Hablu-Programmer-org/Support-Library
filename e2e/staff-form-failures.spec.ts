import { test, expect } from "@playwright/test";
import mongoose from "mongoose";

import { dbConnect } from "../lib/db";
import { SupportIssueModel } from "../models";

/**
 * The status picker and the archive button report a rejected save in place.
 *
 * Both used to go through a "simple form" wrapper that re-threw the failure, so
 * a stale revision or the rate limit replaced the whole case page with
 * "Something Went Wrong" — the same symptom the reply composer had.
 *
 * The case is seeded directly (no UI create) so the test does not spend the
 * staff `issue.create` budget.
 */
test.use({ storageState: "e2e/.auth/mentor.json" });

let issuePath = "";

test.beforeAll(async () => {
  await dbConnect();
  const issue = await SupportIssueModel.create({
    title: "E2E stale status revision",
    question: "Does a stale status save report itself?",
    searchText: "e2e stale status revision",
    createdBy: new mongoose.Types.ObjectId(),
    status: "OPEN",
    priority: "NORMAL",
    visibility: "INTERNAL",
  });
  issuePath = `/dashboard/issues/${String(issue._id)}`;
});

test.describe("Staff form failure reporting", () => {
  test("a stale status revision shows its reason instead of the error page", async ({ page }) => {
    await page.goto(issuePath);

    // Pretend the page was rendered against an older revision of the issue.
    await page.locator('input[name="expectedUpdatedAt"]').evaluate((input) => {
      (input as HTMLInputElement).value = "2000-01-01T00:00:00.000Z";
    });
    await page.getByLabel("Status").selectOption("PENDING");

    await expect(
      page.getByRole("alert").filter({ hasText: /Issue changed since you opened it/ }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Something Went Wrong" })).toHaveCount(0);
  });
});
